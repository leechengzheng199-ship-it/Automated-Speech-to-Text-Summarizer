import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { startTranscription } from "@/lib/jobs";
import { buildAudioUrl } from "@/lib/qiniu";
import { ensureDefaults } from "@/lib/seed";
import { getAppSettings } from "@/lib/settings";
import { QINIU_LIMITS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  await ensureDefaults();
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(jobs);
}

export async function POST(request: Request) {
  const settings = await getAppSettings();
  if (!settings.qiniuConfigured) {
    return NextResponse.json(
      { error: "请先在设置页填写七牛云 AccessKey、SecretKey、Bucket 和访问域名。" },
      { status: 400 },
    );
  }
  if (!settings.dashscopeConfigured) {
    return NextResponse.json(
      { error: "请先在设置页填写阿里云百炼 API Key，用于 Paraformer 转写。" },
      { status: 400 },
    );
  }

  const body = (await request.json()) as {
    fileName?: string;
    fileSize?: number;
    durationMs?: number | null;
    kodoKey?: string;
    templateId?: string | null;
  };

  if (!body.fileName || typeof body.fileSize !== "number" || !body.kodoKey) {
    return NextResponse.json({ error: "缺少 fileName、fileSize 或 kodoKey。" }, { status: 400 });
  }

  if (body.fileSize > QINIU_LIMITS.maxUploadBytes) {
    return NextResponse.json({ error: `处理后的文件超过 ${QINIU_LIMITS.maxUploadLabel} 限制。` }, { status: 400 });
  }

  if (body.durationMs && body.durationMs > QINIU_LIMITS.maxDurationMs) {
    return NextResponse.json({ error: `音频超过 ${QINIU_LIMITS.maxDurationLabel} 限制。` }, { status: 400 });
  }

  const audioUrl = buildAudioUrl(settings.qiniu, body.kodoKey);
  const job = await prisma.job.create({
    data: {
      fileName: body.fileName,
      fileSize: body.fileSize,
      durationMs: body.durationMs ?? null,
      kodoKey: body.kodoKey,
      audioUrl,
      templateId: body.templateId || null,
      status: "uploaded",
    },
  });

  try {
    const started = await startTranscription(job.id);
    return NextResponse.json(started, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "提交转写失败。";
    const failed = await prisma.job.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: message },
      include: { transcript: true, summary: true },
    });
    return NextResponse.json(failed, { status: 201 });
  }
}
