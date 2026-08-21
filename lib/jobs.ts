import type { Job, Summary, Transcript } from "@prisma/client";

import { prisma } from "@/lib/db";
import { generateSummary, isLlmConfigured } from "@/lib/llm";
import { describeNetworkError } from "@/lib/network";
import {
  isParaformerFileForbidden,
  queryParaformerTask,
  submitParaformerTask,
  uploadToDashscopeOss,
} from "@/lib/paraformer";
import { buildAudioUrl, downloadQiniuObject } from "@/lib/qiniu";
import { getAppSettings } from "@/lib/settings";
import { buildSummaryPrompt } from "@/lib/templates";
import type { JobStatus, TemplateSection } from "@/lib/types";

export type JobWithRelations = Job & {
  transcript: Transcript | null;
  summary: Summary | null;
};

const inflight = new Map<string, Promise<JobWithRelations | null>>();
const ossFallbackTried = new Set<string>();

function asErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "未知错误";
  if (error.message === "fetch failed") {
    return `网络请求失败：${describeNetworkError(error)}`;
  }
  return error.message;
}

async function submitViaOss(job: { id: string; fileName: string; kodoKey: string }) {
  const settings = await getAppSettings();
  const file = await downloadQiniuObject(settings.qiniu, job.kodoKey);
  const ossUrl = await uploadToDashscopeOss({
    settings: settings.dashscope,
    fileName: job.fileName,
    data: file.buffer,
    contentType: file.contentType,
  });
  return submitParaformerTask({
    settings: settings.dashscope,
    audioUrl: ossUrl,
  });
}

export async function startTranscription(jobId: string, options?: { forceOss?: boolean }) {
  const settings = await getAppSettings();
  if (!settings.dashscopeConfigured) {
    throw new Error("请先在设置页填写阿里云百炼 API Key。");
  }
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job?.kodoKey) {
    throw new Error("任务缺少已上传的音频文件。");
  }

  const audioUrl = job.audioUrl || buildAudioUrl(settings.qiniu, job.kodoKey);
  let taskId: string;

  if (!options?.forceOss && audioUrl) {
    try {
      ({ taskId } = await submitParaformerTask({
        settings: settings.dashscope,
        audioUrl,
      }));
    } catch {
      ({ taskId } = await submitViaOss({ id: job.id, fileName: job.fileName, kodoKey: job.kodoKey }));
    }
  } else {
    ({ taskId } = await submitViaOss({ id: job.id, fileName: job.fileName, kodoKey: job.kodoKey }));
  }

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
    data: { status: "summarizing", errorMessage: null, templateId: template.id },
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
      templateSnapshot: JSON.stringify({
        name: template.name,
        systemPrompt: template.systemPrompt,
        sections,
      }),
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

export async function regenerateSummary(jobId: string, templateId?: string | null) {
  const current = inflight.get(jobId);
  if (current) return current;

  const pending = (async (): Promise<JobWithRelations | null> => {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { transcript: true, summary: true },
    });
    if (!job) return null;
    if (!job.transcript?.resultText?.trim()) {
      throw new Error("还没有转写原文，无法生成总结。");
    }

    const nextTemplateId = templateId?.trim() || job.templateId;
    const withTemplate = await prisma.job.update({
      where: { id: jobId },
      data: {
        templateId: nextTemplateId,
        status: "summarizing",
        errorMessage: null,
      },
      include: { transcript: true, summary: true },
    });

    return runSummary(withTemplate);
  })()
    .catch(async (error) => {
      if (error instanceof Error && error.message.includes("还没有转写原文")) {
        throw error;
      }
      const latest = await prisma.job.findUnique({
        where: { id: jobId },
        include: { transcript: true, summary: true },
      });
      if (!latest) return null;
      return prisma.job.update({
        where: { id: jobId },
        data: { status: "failed", errorMessage: asErrorMessage(error) },
        include: { transcript: true, summary: true },
      });
    })
    .finally(() => {
      if (inflight.get(jobId) === pending) inflight.delete(jobId);
    });

  inflight.set(jobId, pending);
  return pending;
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
      if (
        isParaformerFileForbidden(result.errorCode, result.errorMessage) &&
        job.kodoKey &&
        !ossFallbackTried.has(job.id)
      ) {
        ossFallbackTried.add(job.id);
        return startTranscription(job.id, { forceOss: true });
      }
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

  if (status === "summarizing" && job.transcript) {
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
