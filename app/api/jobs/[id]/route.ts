import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { transcript: true, summary: true },
  });

  if (!job) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  return NextResponse.json(job);
}
