export type LlmSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

const MAX_TRANSCRIPT_CHARS = 100_000;

export function isLlmConfigured(settings: LlmSettings) {
  return Boolean(settings.baseUrl && settings.apiKey && settings.model);
}

function chatCompletionsUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/v1")) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

function unwrapMarkdown(text: string) {
  const trimmed = text.trim();
  const matched = trimmed.match(/^```(?:markdown|md)?\s*([\s\S]*?)\s*```$/i);
  return matched ? matched[1].trim() : trimmed;
}

export async function generateSummary(params: {
  settings: LlmSettings;
  system: string;
  user: string;
}): Promise<{ markdown: string; rawOutput: string }> {
  const transcriptStart = params.user.indexOf("转写原文：");
  const prefix = transcriptStart >= 0 ? params.user.slice(0, transcriptStart) : "";
  const transcript = transcriptStart >= 0 ? params.user.slice(transcriptStart) : params.user;
  const clipped =
    transcript.length > MAX_TRANSCRIPT_CHARS
      ? `${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}\n\n[原文过长，已截断]`
      : transcript;
  const user = `${prefix}${clipped}`;

  const response = await fetch(chatCompletionsUrl(params.settings.baseUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.settings.model,
      temperature: 0.3,
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: user },
      ],
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`模型接口 HTTP ${response.status}：${text.slice(0, 300)}`);
  }

  let content = "";
  try {
    const json = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    content = json.choices?.[0]?.message?.content ?? "";
  } catch {
    throw new Error(`模型接口返回无法解析：${text.slice(0, 200)}`);
  }

  if (!content.trim()) {
    throw new Error("模型没有返回总结内容。");
  }

  return {
    markdown: unwrapMarkdown(content),
    rawOutput: content,
  };
}
