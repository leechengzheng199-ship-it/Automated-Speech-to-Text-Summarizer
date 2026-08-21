import { NextResponse } from "next/server";

import { syncJob } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = await syncJob(id);

  if (!job) {
    return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
  }

  return NextResponse.json(job);
}
