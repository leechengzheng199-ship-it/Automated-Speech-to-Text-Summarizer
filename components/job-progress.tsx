import { Check, Loader2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { JobStatus } from "@/lib/types";

const STEPS = [
  { id: "uploaded", label: "上传" },
  { id: "transcribing", label: "转写" },
  { id: "summarizing", label: "总结" },
  { id: "done", label: "完成" },
] as const;

type StepState = "complete" | "current" | "pending" | "error";

function progressOf(status: JobStatus, hasTranscript: boolean) {
  if (status === "done") return { current: 3, completed: 4 };
  if (status === "summarizing") return { current: 2, completed: 2 };
  if (status === "transcribing") return { current: 1, completed: 1 };
  if (status === "failed") {
    const current = hasTranscript ? 2 : 1;
    return { current, completed: current, failed: true };
  }
  if (status === "uploaded") return { current: 1, completed: 1 };
  return { current: 0, completed: 0 };
}

function stepState(index: number, current: number, completed: number, failed: boolean): StepState {
  if (failed && index === current) return "error";
  if (index < completed) return "complete";
  if (index === current && !failed) return "current";
  return "pending";
}

const HINT: Record<JobStatus, string> = {
  queued: "等待开始处理。",
  uploaded: "文件已上传，即将开始转写。",
  transcribing: "正在识别语音，页面会自动刷新。",
  summarizing: "正在按模板生成总结。",
  done: "处理完成。",
  failed: "这一步失败了，可重新提交转写。",
};

export function JobProgress({
  status,
  hasTranscript,
}: {
  status: JobStatus;
  hasTranscript: boolean;
}) {
  const { current, completed, failed = false } = progressOf(status, hasTranscript);
  const fill = Math.min(1, completed / (STEPS.length - 1));

  return (
    <div>
      <div className="relative px-1 sm:px-2">
        <div className="absolute top-4 right-7 left-7 h-0.5 rounded-full bg-muted" aria-hidden />
        <div
          className={cn(
            "absolute top-4 left-7 h-0.5 origin-left rounded-full transition-transform duration-500 ease-out motion-reduce:transition-none",
            failed ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: "calc(100% - 56px)", transform: `scaleX(${fill})` }}
          aria-hidden
        />
        <ol className="relative flex justify-between" aria-label="处理进度">
          {STEPS.map((step, index) => {
            const state = stepState(index, current, completed, failed);
            return (
              <li key={step.id} className="flex w-12 flex-col items-center gap-2 sm:w-14">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full border text-xs transition-colors duration-300 motion-reduce:transition-none",
                    state === "complete" && "border-emerald-600 bg-emerald-600 text-white",
                    state === "current" && "border-primary bg-primary text-primary-foreground",
                    state === "error" && "border-destructive bg-destructive text-white",
                    state === "pending" && "border-border bg-background text-muted-foreground",
                  )}
                  aria-current={state === "current" ? "step" : undefined}
                >
                  {state === "complete" ? (
                    <Check className="size-3.5" />
                  ) : state === "error" ? (
                    <X className="size-3.5" />
                  ) : state === "current" ? (
                    <Loader2 className="size-3.5 motion-safe:animate-spin" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    state === "pending" && "text-muted-foreground",
                    state === "error" && "text-destructive",
                    (state === "complete" || state === "current") && "font-medium",
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-4 text-center text-sm text-muted-foreground">{HINT[status]}</p>
    </div>
  );
}
