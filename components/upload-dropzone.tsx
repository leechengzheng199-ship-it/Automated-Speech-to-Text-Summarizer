"use client";

import { useMemo, useState } from "react";
import { Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QINIU_LIMITS } from "@/lib/types";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtension(name: string) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

export function UploadDropzone() {
  const [file, setFile] = useState<File | null>(null);

  const issues = useMemo(() => {
    if (!file) return [];
    const messages: string[] = [];
    const ext = getExtension(file.name);
    if (!QINIU_LIMITS.supportedExtensions.includes(ext as (typeof QINIU_LIMITS.supportedExtensions)[number])) {
      messages.push("当前扩展名不在计划支持列表中。");
    }
    if (file.size > QINIU_LIMITS.maxFileBytes) {
      messages.push("文件超过 512MB，超出七牛长语音识别限制。");
    }
    return messages;
  }, [file]);

  const needsTranscode = file
    ? !QINIU_LIMITS.nativeAsrExtensions.includes(
        getExtension(file.name) as (typeof QINIU_LIMITS.nativeAsrExtensions)[number],
      )
    : false;

  return (
    <Card>
      <CardHeader>
        <CardTitle>上传录音</CardTitle>
        <CardDescription>
          选择本地音频。后续会在浏览器解析并压缩，再直传七牛云转写。本阶段只做文件校验，不发起实际上传。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center hover:bg-accent/40">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium">点击选择或拖放音频文件</p>
            <p className="mt-1 text-sm text-muted-foreground">
              支持 mp3 / wav / ogg / mp4；m4a、webm 等将在后续转成 mp3。上限 512MB、5 小时。
            </p>
          </div>
          <input
            type="file"
            accept="audio/*,video/mp4,.mp3,.wav,.ogg,.m4a,.webm,.aac,.flac"
            className="sr-only"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
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
              {needsTranscode ? <Badge variant="warning">需转码</Badge> : <Badge variant="success">可直传</Badge>}
            </div>
          </div>
        ) : null}

        {issues.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}

        <Button disabled title="解析压缩、七牛转写与 LLM 总结将在后续迭代接入">
          开始处理（尚未接入）
        </Button>
      </CardContent>
    </Card>
  );
}
