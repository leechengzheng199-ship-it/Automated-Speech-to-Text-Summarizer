import { describeNetworkError } from "@/lib/network";

export type DashscopeSettings = {
  apiKey: string;
  model: string;
};

const SUBMIT_URL = "https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription";
const TASK_URL = "https://dashscope.aliyuncs.com/api/v1/tasks";
const DEFAULT_MODEL = "paraformer-v2";

type SubmitResponse = {
  request_id?: string;
  code?: string;
  message?: string;
  output?: {
    task_id?: string;
    task_status?: string;
  };
};

type QueryResponse = {
  request_id?: string;
  code?: string;
  message?: string;
  output?: {
    task_id?: string;
    task_status?: string;
    results?: Array<{
      file_url?: string;
      transcription_url?: string;
      subtask_status?: string;
      code?: string;
      message?: string;
    }>;
  };
};

type TranscriptionFile = {
  properties?: {
    original_duration_in_milliseconds?: number;
  };
  transcripts?: Array<{
    text?: string;
    sentences?: Array<{
      text?: string;
      speaker_id?: number;
    }>;
  }>;
};

export function isDashscopeConfigured(settings: DashscopeSettings) {
  return Boolean(settings.apiKey);
}

function modelName(settings: DashscopeSettings) {
  return settings.model.trim() || DEFAULT_MODEL;
}

function describeError(status: number, payload: { code?: string; message?: string }, raw: string) {
  const detail = payload.message || raw.replace(/\s+/g, " ").trim().slice(0, 180);
  if (status === 401 || payload.code === "InvalidApiKey") {
    return `阿里云百炼鉴权失败，请核对 DashScope API Key。${detail ? ` ${detail}` : ""}`;
  }
  if (status === 403) {
    return `阿里云 Paraformer 返回 403。请确认已开通语音识别并有可用额度。${detail ? ` ${detail}` : ""}`;
  }
  return `Paraformer 接口 HTTP ${status}${payload.code ? `（${payload.code}）` : ""}${detail ? `：${detail}` : ""}`;
}

function describeTaskFailure(code?: string, message?: string) {
  if (code === "FILE_403_FORBIDDEN" || /FILE_403/.test(message || "")) {
    return "阿里云无法直接读取七牛外链（FILE_403_FORBIDDEN）。请点「重新提交转写」，系统会改为本机拉取后再交给 Paraformer。";
  }
  return message || code || "Paraformer 转写失败。";
}

async function fetchOrThrow(url: string | URL, init?: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (error) {
    const host = (() => {
      try {
        return new URL(url).host;
      } catch {
        return url;
      }
    })();
    throw new Error(`请求 ${host} 失败：${describeNetworkError(error)}`);
  }
}

async function dashscopeJson<T extends { code?: string; message?: string }>(
  apiKey: string,
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetchOrThrow(url, {
    method: init?.method ?? "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    body: init?.body,
  });
  const text = await response.text();
  let parsed: T;
  try {
    parsed = JSON.parse(text) as T;
  } catch {
    throw new Error(describeError(response.status, {}, text));
  }
  if (!response.ok || parsed.code) {
    throw new Error(describeError(response.status, parsed, text));
  }
  return parsed;
}

export async function uploadToDashscopeOss(params: {
  settings: DashscopeSettings;
  fileName: string;
  data: Buffer;
  contentType?: string;
}): Promise<string> {
  const model = modelName(params.settings);
  const policyUrl = new URL("https://dashscope.aliyuncs.com/api/v1/uploads");
  policyUrl.searchParams.set("action", "getPolicy");
  policyUrl.searchParams.set("model", model);

  const policyResponse = await fetchOrThrow(policyUrl, {
    headers: {
      Authorization: `Bearer ${params.settings.apiKey}`,
      "Content-Type": "application/json",
    },
  });
  const policyText = await policyResponse.text();
  let policyJson: {
    code?: string;
    message?: string;
    data?: {
      upload_dir?: string;
      upload_host?: string;
      oss_access_key_id?: string;
      signature?: string;
      policy?: string;
      x_oss_object_acl?: string;
      x_oss_forbid_overwrite?: string;
    };
  };
  try {
    policyJson = JSON.parse(policyText) as typeof policyJson;
  } catch {
    throw new Error(`获取百炼上传凭证失败：${policyText.slice(0, 180)}`);
  }
  if (!policyResponse.ok || policyJson.code || !policyJson.data?.upload_host || !policyJson.data.upload_dir) {
    throw new Error(describeError(policyResponse.status, policyJson, policyText));
  }

  const extIndex = params.fileName.lastIndexOf(".");
  const ext = extIndex >= 0 ? params.fileName.slice(extIndex) : ".bin";
  const objectKey = `${policyJson.data.upload_dir}/${Date.now()}${ext}`;
  const form = new FormData();
  form.append("OSSAccessKeyId", policyJson.data.oss_access_key_id || "");
  form.append("Signature", policyJson.data.signature || "");
  form.append("policy", policyJson.data.policy || "");
  form.append("x-oss-object-acl", policyJson.data.x_oss_object_acl || "private");
  form.append("x-oss-forbid-overwrite", policyJson.data.x_oss_forbid_overwrite || "true");
  form.append("key", objectKey);
  form.append("success_action_status", "200");
  form.append(
    "file",
    new File([new Uint8Array(params.data)], params.fileName, {
      type: params.contentType || "application/octet-stream",
    }),
  );

  const uploadResponse = await fetchOrThrow(policyJson.data.upload_host, {
    method: "POST",
    body: form,
  });
  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`上传音频到百炼临时存储失败（HTTP ${uploadResponse.status}）${text ? `：${text.slice(0, 180)}` : ""}`);
  }

  return `oss://${objectKey}`;
}

export async function submitParaformerTask(params: {
  settings: DashscopeSettings;
  audioUrl: string;
}): Promise<{ taskId: string }> {
  const headers: Record<string, string> = { "X-DashScope-Async": "enable" };
  if (params.audioUrl.startsWith("oss://")) {
    headers["X-DashScope-OssResourceResolve"] = "enable";
  }

  const result = await dashscopeJson<SubmitResponse>(params.settings.apiKey, SUBMIT_URL, {
    headers,
    body: JSON.stringify({
      model: modelName(params.settings),
      input: { file_urls: [params.audioUrl] },
      parameters: {
        channel_id: [0],
        language_hints: ["zh", "en"],
      },
    }),
  });

  const taskId = result.output?.task_id;
  if (!taskId) {
    throw new Error("提交 Paraformer 转写失败：未返回 task_id。");
  }
  return { taskId };
}

export async function queryParaformerTask(params: {
  settings: DashscopeSettings;
  taskId: string;
}): Promise<{
  status: string;
  resultText?: string;
  durationMs?: number;
  detail?: unknown;
  errorMessage?: string;
}> {
  const result = await dashscopeJson<QueryResponse>(
    params.settings.apiKey,
    `${TASK_URL}/${encodeURIComponent(params.taskId)}`,
  );

  const status = result.output?.task_status ?? "UNKNOWN";
  const first = result.output?.results?.[0];

  if (status === "PENDING" || status === "RUNNING") {
    return { status };
  }

  if (status !== "SUCCEEDED" || first?.subtask_status === "FAILED") {
    return {
      status: "FAILED",
      errorMessage: describeTaskFailure(first?.code, first?.message || result.message),
    };
  }

  if (!first?.transcription_url) {
    return { status: "FAILED", errorMessage: "Paraformer 未返回识别结果文件。" };
  }

  const fileResponse = await fetchOrThrow(first.transcription_url);
  if (!fileResponse.ok) {
    throw new Error(`下载 Paraformer 识别结果失败（HTTP ${fileResponse.status}）。`);
  }
  const file = (await fileResponse.json()) as TranscriptionFile;
  const resultText = (file.transcripts ?? [])
    .map((item) => item.text?.trim())
    .filter(Boolean)
    .join("\n");

  if (!resultText) {
    return { status: "FAILED", errorMessage: "Paraformer 识别结果为空。" };
  }

  return {
    status: "SUCCEEDED",
    resultText,
    durationMs: file.properties?.original_duration_in_milliseconds,
    detail: file.transcripts ?? [],
  };
}

export async function testParaformerAccess(settings: DashscopeSettings) {
  try {
    await submitParaformerTask({
      settings,
      audioUrl: "https://example.com/paraformer-permission-check.mp3",
    });
    return { ok: true, message: "Paraformer 鉴权通过。探测地址不是真实音频，工作台上传后才会真正转写。" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "检测失败。";
    if (/鉴权失败|InvalidApiKey|HTTP 401|HTTP 403/.test(message)) {
      return { ok: false, message };
    }
    return {
      ok: true,
      message: `Paraformer 接口可达。探测地址不是真实音频，工作台上传后才会真正转写（${message}）。`,
    };
  }
}
