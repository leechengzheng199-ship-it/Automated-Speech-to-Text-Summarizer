"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JobProgress } from "@/components/job-progress";
import { Separator } from "@/components/ui/separator";
import type { JobStatus } from "@/lib/types";

type JobPayload = {
  id: string;
  fileName: string;
  fileSize: number;
  kodoKey: string | null;
  audioUrl: string | null;
  asrTaskId: string | null;
  templateId: string | null;
  status: string;
  errorMessage: string | null;
  transcript: { resultText: string } | null;
  summary: { markdown: string } | null;
};

type TemplateOption = { id: string; name: string };

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "排队中",
  uploaded: "已上传",
  transcribing: "转写中",
  summarizing: "总结中",
  done: "已完成",
  failed: "失败",
};

const ACTIVE_STATUSES = new Set<JobStatus>(["queued", "uploaded", "transcribing", "summarizing"]);
const TRANSCRIPT_PREVIEW_CHARS = 480;

function downloadMarkdown(fileName: string, markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${fileName.replace(/\.[^.]+$/, "")}-总结.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

export function JobDetail({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobPayload | null>(null);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [error, setError] = useState("");
  const [pollKey, setPollKey] = useState(0);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const templateSynced = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/templates", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: TemplateOption[]) => {
        if (cancelled || !Array.isArray(data)) return;
        setTemplates(data.map((item) => ({ id: item.id, name: item.name })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

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
        if (!templateSynced.current && data.templateId) {
          templateSynced.current = true;
          setTemplateId(data.templateId);
        }
        const status = data.status as JobStatus;
        if (ACTIVE_STATUSES.has(status)) {
          const wait = status === "transcribing" ? 2000 : status === "summarizing" ? 2500 : 4000;
          timer = setTimeout(tick, wait);
        } else {
          setSummarizing(false);
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

  useEffect(() => {
    if (!templateId && templates[0]) setTemplateId(templates[0].id);
  }, [templateId, templates]);

  if (!job) {
    return <p className="text-sm text-muted-foreground">{error || "正在加载任务…"}</p>;
  }

  const status = job.status as JobStatus;
  const transcript = job.transcript?.resultText ?? "";
  const longTranscript = transcript.length > TRANSCRIPT_PREVIEW_CHARS;
  const shownTranscript =
    transcriptOpen || !longTranscript ? transcript : `${transcript.slice(0, TRANSCRIPT_PREVIEW_CHARS).trimEnd()}…`;
  const canSummarize = Boolean(job.transcript) && !ACTIVE_STATUSES.has(status) && !summarizing;

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
        </CardHeader>
        <CardContent className="space-y-5">
          <JobProgress
            status={status}
            hasTranscript={Boolean(job.transcript)}
          />
          <p className="text-center text-sm text-muted-foreground">
            {(job.fileSize / (1024 * 1024)).toFixed(2)} MB
          </p>
          {job.errorMessage ? <p className="text-center text-sm text-destructive">{job.errorMessage}</p> : null}
          {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
          {status === "failed" && job.kodoKey ? (
            <div className="flex justify-center">
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
            </div>
          ) : null}
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer select-none">技术信息</summary>
            <div className="mt-2 space-y-1 break-all">
              <p>七牛 key：{job.kodoKey || "尚未上传"}</p>
              <p>音频外链：{job.audioUrl || "尚未生成"}</p>
              <p>Paraformer 任务 ID：{job.asrTaskId || "尚未提交"}</p>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>转写原文</CardTitle>
          <CardDescription>阿里云 Paraformer 识别完成后会自动出现在这里。默认折叠，点击展开全文。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {job.transcript ? (
            <>
              <pre
                onClick={() => {
                  if (!transcriptOpen && longTranscript) setTranscriptOpen(true);
                }}
                className={
                  transcriptOpen
                    ? "max-h-[min(70vh,36rem)] overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-6"
                    : "max-h-36 cursor-pointer overflow-hidden whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-6"
                }
              >
                {shownTranscript}
              </pre>
              <div className="flex flex-wrap gap-2">
                {longTranscript ? (
                  <Button variant="outline" size="sm" onClick={() => setTranscriptOpen((open) => !open)}>
                    {transcriptOpen ? "收起" : "展开全文"}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await copyText(transcript);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? "已复制" : "复制原文"}
                </Button>
              </div>
            </>
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
          <CardDescription>可更换模板，基于已有转写重新生成，不会重新上传或转写。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {templates.length > 0 ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <label className="mb-2 block text-sm font-medium">总结模板</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                  disabled={summarizing || status === "summarizing"}
                >
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={!canSummarize}
                onClick={async () => {
                  setError("");
                  setSummarizing(true);
                  const response = await fetch(`/api/jobs/${jobId}/summarize`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ templateId: templateId || null }),
                  });
                  const data = (await response.json().catch(() => ({}))) as JobPayload & { error?: string };
                  if (!response.ok) {
                    setError(data.error || "重新生成总结失败。");
                    setSummarizing(false);
                    return;
                  }
                  setJob(data);
                  setPollKey((value) => value + 1);
                }}
              >
                {summarizing || status === "summarizing" ? "正在生成总结…" : "重新生成总结"}
              </Button>
            </div>
          ) : null}
          {job.summary ? (
            <pre className="max-h-[min(70vh,36rem)] overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-6">
              {job.summary.markdown}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              {status === "summarizing" || summarizing
                ? "正在按模板生成总结…"
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
