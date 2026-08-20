import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { ensureDefaults } from "@/lib/seed";
import { JOB_STATUSES, QINIU_LIMITS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDefaults();
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(jobs);
}

export async function POST(request: Request) {
  await ensureDefaults();
  const body = (await request.json()) as {
    fileName?: string;
    fileSize?: number;
    durationMs?: number;
    templateId?: string;
  };

  if (!body.fileName || typeof body.fileSize !== "number") {
    return NextResponse.json({ error: "缺少 fileName 或 fileSize。" }, { status: 400 });
  }

  if (body.fileSize > QINIU_LIMITS.maxFileBytes) {
    return NextResponse.json({ error: "文件超过 512MB 限制。" }, { status: 400 });
  }

  if (body.durationMs && body.durationMs > QINIU_LIMITS.maxDurationMs) {
    return NextResponse.json({ error: "音频超过 5 小时限制。" }, { status: 400 });
  }

  const job = await prisma.job.create({
    data: {
      fileName: body.fileName,
      fileSize: body.fileSize,
      durationMs: body.durationMs,
      templateId: body.templateId,
      status: JOB_STATUSES[0],
    },
  });

  return NextResponse.json(job, { status: 201 });
}
