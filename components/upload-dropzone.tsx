"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import { getPrepareAction, predictedOutputName } from "@/lib/audio-strategy";
import { prepareUploadFile, preloadFfmpeg, readMediaDurationMs } from "@/lib/audio-client";
import { uploadToQiniu } from "@/lib/qiniu-upload";
import { QINIU_LIMITS } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type TemplateOption = { id: string; name: string };

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getExtension(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

async function readError(response: Response) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || `请求失败（HTTP ${response.status}）`;
  } catch {
    return `请求失败（HTTP ${response.status}）`;
  }
}

async function fetchUploadToken(fileName: string) {
  const tokenRes = await fetch("/api/upload-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName }),
  });
  if (!tokenRes.ok) throw new Error(await readError(tokenRes));
  return (await tokenRes.json()) as { token: string; key: string; uploadUrl: string };
}

export function UploadDropzone({
  qiniuConfigured,
  dashscopeConfigured,
  llmConfigured,
  templates,
}: {
  qiniuConfigured: boolean;
  dashscopeConfigured: boolean;
  llmConfigured: boolean;
  templates: TemplateOption[];
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const action = file ? getPrepareAction(file.name) : "direct";
  const issues = useMemo(() => {
    if (!file) return [];
    const messages: string[] = [];
    const ext = getExtension(file.name);
    if (
      !QINIU_LIMITS.supportedExtensions.includes(
        ext as (typeof QINIU_LIMITS.supportedExtensions)[number],
      )
    ) {
      messages.push("当前扩展名不在支持列表中。");
    }
    if (file.size > QINIU_LIMITS.maxFileBytes) {
      messages.push(`文件超过 ${QINIU_LIMITS.maxFileLabel}。`);
    }
    return messages;
  }, [file]);

  const canSubmit = Boolean(file) && issues.length === 0 && qiniuConfigured && dashscopeConfigured && !busy;

  function pickFile(next: File | null) {
    setFile(next);
    setError("");
    setMessage("");
    setProgress(0);
    if (next) preloadFfmpeg(next.name);
  }

  async function onStart() {
    if (!file || !canSubmit) return;
    setBusy(true);
    setError("");
    setProgress(0);

    try {
      const predictedName = predictedOutputName(file.name, action);
      setMessage("正在准备音频…");
      const durationPromise = readMediaDurationMs(file);
      const preparePromise = durationPromise.then((durationMs) => {
        if (durationMs && durationMs > QINIU_LIMITS.maxDurationMs) {
          throw new Error(`音频超过 ${QINIU_LIMITS.maxDurationLabel} 限制。`);
        }
        return prepareUploadFile(
          file,
          setMessage,
          (ratio) => setProgress(Math.round(ratio * 70)),
          durationMs,
        );
      });
      const tokenPromise = fetchUploadToken(predictedName);
      const [uploadFile, tokenBody] = await Promise.all([preparePromise, tokenPromise]);
      const token =
        uploadFile.name === predictedName ? tokenBody : await fetchUploadToken(uploadFile.name);

      if (uploadFile.size > QINIU_LIMITS.maxFileBytes) {
        throw new Error(`处理后的文件仍超过 ${QINIU_LIMITS.maxFileLabel} 限制。`);
      }

      setMessage("正在上传到七牛云…");
      await uploadToQiniu({
        file: uploadFile,
        token: token.token,
        key: token.key,
        uploadUrl: token.uploadUrl,
        onProgress: (ratio) => setProgress(70 + Math.round(ratio * 30)),
      });

      setMessage("正在提交转写任务…");
      const jobRes = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: uploadFile.size,
          durationMs: await durationPromise,
          kodoKey: token.key,
          templateId: templateId || null,
        }),
      });
      if (!jobRes.ok) throw new Error(await readError(jobRes));
      const job = (await jobRes.json()) as { id: string };
      router.push(`/jobs/${job.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "处理失败。");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>上传录音</CardTitle>
        <CardDescription>
          选择本地音频或视频。视频会先抽出音轨再上传，无损音频会压成 AAC；mp3 / m4a 等可直接传。
          {!qiniuConfigured ? " 请先到设置页填写七牛云配置。" : null}
          {qiniuConfigured && !dashscopeConfigured ? " 请先到设置页填写阿里云百炼 API Key。" : null}
          {qiniuConfigured && dashscopeConfigured && !llmConfigured
            ? " 未配置总结模型时，将只保留转写原文。"
            : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label
          className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center hover:bg-accent/40"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            pickFile(event.dataTransfer.files?.[0] ?? null);
          }}
        >
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">点击选择或拖放音频文件</p>
            <p className="mt-1 text-sm text-muted-foreground">
              支持 mp3 / wav / ogg / mp4 / m4a / webm 等。上限 {QINIU_LIMITS.maxFileLabel}、
              {QINIU_LIMITS.maxDurationLabel}。
            </p>
          </div>
          <input
            type="file"
            accept="audio/*,video/mp4,.mp3,.wav,.ogg,.m4a,.webm,.aac,.flac"
            className="sr-only"
            onChange={(event) => {
              pickFile(event.target.files?.[0] ?? null);
              event.target.value = "";
            }}
          />
        </label>

        {file ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-3">
            <div>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatSize(file.size)} · {file.type || "未知类型"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {action === "extract" ? (
                <Badge variant="warning">抽音轨</Badge>
              ) : action === "compress" ? (
                <Badge variant="warning">将压缩</Badge>
              ) : (
                <Badge variant="success">可直传</Badge>
              )}
            </div>
          </div>
        ) : null}

        {templates.length > 0 ? (
          <div className="max-w-sm">
            <Label className="mb-2 block">总结模板</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              disabled={busy}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {issues.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}

        {busy ? (
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(progress, 4)}%` }} />
          </div>
        ) : null}

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Button onClick={onStart} disabled={!canSubmit}>
          {busy
            ? "处理中…"
            : !qiniuConfigured
              ? "请先配置七牛云"
              : !dashscopeConfigured
                ? "请先配置 Paraformer"
                : "开始处理"}
        </Button>
      </CardContent>
    </Card>
  );
}
