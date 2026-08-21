import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { startTranscription } from "@/lib/jobs";
import { buildAudioUrl } from "@/lib/qiniu";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const settings = await getAppSettings();
  const job = await prisma.job.findUnique({ where: { id } });

  if (!job) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }
  if (!job.kodoKey) {
    return NextResponse.json({ error: "任务没有已上传的音频，请重新上传。" }, { status: 400 });
  }
  if (!settings.qiniuConfigured) {
    return NextResponse.json({ error: "请先在设置页配置七牛云。" }, { status: 400 });
  }
  if (!settings.dashscopeConfigured) {
    return NextResponse.json({ error: "请先在设置页填写阿里云百炼 API Key。" }, { status: 400 });
  }

  await prisma.job.update({
    where: { id },
    data: {
      audioUrl: buildAudioUrl(settings.qiniu, job.kodoKey),
      asrTaskId: null,
      status: "uploaded",
      errorMessage: null,
    },
  });

  try {
    const started = await startTranscription(id);
    return NextResponse.json(started);
  } catch (error) {
    const message = error instanceof Error ? error.message : "重新提交转写失败。";
    const failed = await prisma.job.update({
      where: { id },
      data: { status: "failed", errorMessage: message },
      include: { transcript: true, summary: true },
    });
    return NextResponse.json(failed, { status: 200 });
  }
}
