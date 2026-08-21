import type { Job, Summary, Transcript } from "@prisma/client";

import { prisma } from "@/lib/db";
import { generateSummary, isLlmConfigured } from "@/lib/llm";
import { describeNetworkError } from "@/lib/network";
import { queryParaformerTask, submitParaformerTask, uploadToDashscopeOss } from "@/lib/paraformer";
import { downloadQiniuObject } from "@/lib/qiniu";
import { getAppSettings } from "@/lib/settings";
import { buildSummaryPrompt } from "@/lib/templates";
import type { JobStatus, TemplateSection } from "@/lib/types";

export type JobWithRelations = Job & {
  transcript: Transcript | null;
  summary: Summary | null;
};

const inflight = new Map<string, Promise<JobWithRelations | null>>();

function asErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "未知错误";
  if (error.message === "fetch failed") {
    return `网络请求失败：${describeNetworkError(error)}`;
  }
  return error.message;
}

export async function startTranscription(jobId: string) {
  const settings = await getAppSettings();
  if (!settings.dashscopeConfigured) {
    throw new Error("请先在设置页填写阿里云百炼 API Key。");
  }
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job?.kodoKey) {
    throw new Error("任务缺少已上传的音频文件。");
  }

  const file = await downloadQiniuObject(settings.qiniu, job.kodoKey);
  const ossUrl = await uploadToDashscopeOss({
    settings: settings.dashscope,
    fileName: job.fileName,
    data: file.buffer,
    contentType: file.contentType,
  });

  const { taskId } = await submitParaformerTask({
    settings: settings.dashscope,
    audioUrl: ossUrl,
  });

  return prisma.job.update({
    where: { id: jobId },
    data: {
      asrTaskId: taskId,
      status: "transcribing",
      errorMessage: null,
    },
    include: { transcript: true, summary: true },
  });
}

async function runSummary(job: JobWithRelations) {
  const settings = await getAppSettings();
  if (!job.transcript) return job;
  if (!isLlmConfigured(settings.llm)) {
    return prisma.job.update({
      where: { id: job.id },
      data: { status: "done" },
      include: { transcript: true, summary: true },
    });
  }

  const template = job.templateId
    ? await prisma.template.findUnique({ where: { id: job.templateId } })
    : await prisma.template.findFirst({ orderBy: { createdAt: "asc" } });

  if (!template) {
    return prisma.job.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: "没有可用的总结模板。" },
      include: { transcript: true, summary: true },
    });
  }

  await prisma.job.update({
    where: { id: job.id },
    data: { status: "summarizing", errorMessage: null },
  });

  const sections = JSON.parse(template.sections) as TemplateSection[];
  const prompt = buildSummaryPrompt({
    systemPrompt: template.systemPrompt,
    sections,
    transcript: job.transcript.resultText,
  });

  const result = await generateSummary({
    settings: settings.llm,
    system: prompt.system,
    user: prompt.user,
  });

  await prisma.summary.upsert({
    where: { jobId: job.id },
    create: {
      jobId: job.id,
      templateId: template.id,
      templateSnapshot: JSON.stringify({
        name: template.name,
        systemPrompt: template.systemPrompt,
        sections,
      }),
      markdown: result.markdown,
      rawOutput: result.rawOutput,
    },
    update: {
      templateId: template.id,
      markdown: result.markdown,
      rawOutput: result.rawOutput,
    },
  });

  return prisma.job.update({
    where: { id: job.id },
    data: { status: "done", errorMessage: null },
    include: { transcript: true, summary: true },
  });
}

async function syncJobInner(jobId: string): Promise<JobWithRelations | null> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { transcript: true, summary: true },
  });
  if (!job) return null;

  const status = job.status as JobStatus;

  if (status === "transcribing" && job.asrTaskId) {
    const settings = await getAppSettings();
    let result: Awaited<ReturnType<typeof queryParaformerTask>>;
    try {
      result = await queryParaformerTask({
        settings: settings.dashscope,
        taskId: job.asrTaskId,
      });
    } catch {
      return job;
    }

    if (result.status === "SUCCEEDED" && result.resultText) {
      await prisma.transcript.upsert({
        where: { jobId: job.id },
        create: {
          jobId: job.id,
          resultText: result.resultText,
          detail: JSON.stringify(result.detail ?? []),
          durationMs: result.durationMs,
        },
        update: {
          resultText: result.resultText,
          detail: JSON.stringify(result.detail ?? []),
          durationMs: result.durationMs,
        },
      });

      const withTranscript = await prisma.job.findUniqueOrThrow({
        where: { id: job.id },
        include: { transcript: true, summary: true },
      });
      return runSummary(withTranscript);
    }

    if (result.status === "FAILED") {
      return prisma.job.update({
        where: { id: job.id },
        data: {
          status: "failed",
          errorMessage: result.errorMessage || "Paraformer 转写失败。",
        },
        include: { transcript: true, summary: true },
      });
    }
  }

  if (status === "summarizing" && job.transcript && !job.summary) {
    return runSummary(job);
  }

  return job;
}

export async function syncJob(jobId: string) {
  const current = inflight.get(jobId);
  if (current) return current;

  const pending = syncJobInner(jobId)
    .catch(async (error) => {
      const latest = await prisma.job.findUnique({
        where: { id: jobId },
        include: { transcript: true, summary: true },
      });
      if (latest && (latest.status === "summarizing" || latest.status === "uploaded")) {
        return prisma.job.update({
          where: { id: jobId },
          data: { status: "failed", errorMessage: asErrorMessage(error) },
          include: { transcript: true, summary: true },
        });
      }
      return latest;
    })
    .finally(() => {
      if (inflight.get(jobId) === pending) inflight.delete(jobId);
    });

  inflight.set(jobId, pending);
  return pending;
}
