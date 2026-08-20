import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { prisma } from "@/lib/db";
import type { JobStatus } from "@/lib/types";

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "排队中",
  uploaded: "已上传",
  transcribing: "转写中",
  summarizing: "总结中",
  done: "已完成",
  failed: "失败",
};

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { transcript: true, summary: true },
  });

  if (!job) {
    notFound();
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
          <CardDescription>queued → uploaded → transcribing → summarizing → done</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>文件大小：{(job.fileSize / (1024 * 1024)).toFixed(2)} MB</p>
          <p>七牛 key：{job.kodoKey || "尚未上传"}</p>
          <p>转写任务 ID：{job.qiniuTaskId || "尚未提交"}</p>
          {job.errorMessage ? <p className="text-destructive">{job.errorMessage}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>转写原文</CardTitle>
          <CardDescription>七牛长语音识别结果将显示在这里。</CardDescription>
        </CardHeader>
        <CardContent>
          {job.transcript ? (
            <pre className="whitespace-pre-wrap text-sm leading-6">{job.transcript.resultText}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">转写尚未开始。接入七牛 LASR 后将自动轮询并写入。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>结构化总结</CardTitle>
          <CardDescription>按所选模板生成 Markdown，后续支持复制与下载。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {job.summary ? (
            <pre className="whitespace-pre-wrap text-sm leading-6">{job.summary.markdown}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">总结尚未生成。</p>
          )}
          <Separator />
          <Button disabled>下载 Markdown（尚未接入）</Button>
        </CardContent>
      </Card>
    </div>
  );
}
