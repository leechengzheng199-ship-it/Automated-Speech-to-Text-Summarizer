"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { JobStatus } from "@/lib/types";

type JobPayload = {
  id: string;
  fileName: string;
  fileSize: number;
  kodoKey: string | null;
  audioUrl: string | null;
  asrTaskId: string | null;
  status: string;
  errorMessage: string | null;
  transcript: { resultText: string } | null;
  summary: { markdown: string } | null;
};

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "排队中",
  uploaded: "已上传",
  transcribing: "转写中",
  summarizing: "总结中",
  done: "已完成",
  failed: "失败",
};

const ACTIVE_STATUSES = new Set<JobStatus>(["queued", "uploaded", "transcribing", "summarizing"]);

function downloadMarkdown(fileName: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName.replace(/\.[^.]+$/, "")}-总结.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function JobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobPayload | null>(null);
  const [error, setError] = useState("");
  const [pollKey, setPollKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const response = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("无法读取任务状态。");
        }
        const data = (await response.json()) as JobPayload;
        if (cancelled) return;
        setJob(data);
        setError("");
        const status = data.status as JobStatus;
        if (ACTIVE_STATUSES.has(status)) {
          timer = setTimeout(tick, 4000);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "轮询失败。");
        timer = setTimeout(tick, 6000);
      }
    }

    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, pollKey]);

  if (!job) {
    return <p className="text-sm text-muted-foreground">{error || "正在加载任务…"}</p>;
  }

  const status = job.status as JobStatus;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="hover:underline">
              工作台
            </Link>
            <span> / 任务</span>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{job.fileName}</h1>
        </div>
        <Badge variant={status === "failed" ? "destructive" : status === "done" ? "success" : "warning"}>
          {STATUS_LABEL[status] ?? job.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>处理进度</CardTitle>
          <CardDescription>uploaded → transcribing → summarizing → done</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>文件大小：{(job.fileSize / (1024 * 1024)).toFixed(2)} MB</p>
          <p>七牛 key：{job.kodoKey || "尚未上传"}</p>
          <p className="break-all">音频外链：{job.audioUrl || "尚未生成"}</p>
          <p>Paraformer 任务 ID：{job.asrTaskId || "尚未提交"}</p>
          {job.errorMessage ? <p className="text-destructive">{job.errorMessage}</p> : null}
          {error ? <p className="text-destructive">{error}</p> : null}
          {status === "failed" && job.kodoKey ? (
            <Button
              variant="outline"
              onClick={async () => {
                setError("");
                const response = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
                if (!response.ok) {
                  const data = (await response.json().catch(() => ({}))) as { error?: string };
                  setError(data.error || "重新提交失败。");
                  return;
                }
                const data = (await response.json()) as JobPayload;
                setJob(data);
                setPollKey((value) => value + 1);
              }}
            >
              重新提交转写
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>转写原文</CardTitle>
          <CardDescription>阿里云 Paraformer 识别完成后会自动出现在这里。</CardDescription>
        </CardHeader>
        <CardContent>
          {job.transcript ? (
            <pre className="whitespace-pre-wrap text-sm leading-6">{job.transcript.resultText}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              {status === "transcribing" ? "正在转写，页面会自动刷新。" : "转写尚未完成。"}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>结构化总结</CardTitle>
          <CardDescription>按所选模板生成 Markdown。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {job.summary ? (
            <pre className="whitespace-pre-wrap text-sm leading-6">{job.summary.markdown}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              {status === "summarizing"
                ? "正在生成总结…"
                : status === "done"
                  ? "未配置总结模型，已保留转写原文。"
                  : "总结尚未生成。"}
            </p>
          )}
          <Separator />
          <Button
            disabled={!job.summary}
            onClick={() => job.summary && downloadMarkdown(job.fileName, job.summary.markdown)}
          >
            下载 Markdown
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
