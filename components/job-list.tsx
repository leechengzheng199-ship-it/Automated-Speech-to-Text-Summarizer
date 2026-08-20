import type { Job } from "@prisma/client";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { JobStatus } from "@/lib/types";

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "排队中",
  uploaded: "已上传",
  transcribing: "转写中",
  summarizing: "总结中",
  done: "已完成",
  failed: "失败",
};

const STATUS_VARIANT: Record<
  JobStatus,
  "secondary" | "warning" | "success" | "destructive" | "outline"
> = {
  queued: "secondary",
  uploaded: "outline",
  transcribing: "warning",
  summarizing: "warning",
  done: "success",
  failed: "destructive",
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function JobList({ jobs }: { jobs: Job[] }) {
  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          还没有任务。上传音频后会显示在这里。
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {jobs.map((job) => {
        const status = job.status as JobStatus;
        return (
          <Link key={job.id} href={`/jobs/${job.id}`}>
            <Card className="transition-colors hover:bg-accent/40">
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{job.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatSize(job.fileSize)} · {job.createdAt.toLocaleString("zh-CN")}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[status] ?? "secondary"}>
                  {STATUS_LABEL[status] ?? job.status}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
