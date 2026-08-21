import { NextResponse } from "next/server";

import { regenerateSummary } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let templateId: string | null = null;
  try {
    const body = (await request.json().catch(() => ({}))) as { templateId?: string | null };
    templateId = typeof body.templateId === "string" ? body.templateId : null;
  } catch {
    templateId = null;
  }

  try {
    const job = await regenerateSummary(id, templateId);
    if (!job) {
      return NextResponse.json({ error: "任务不存在。" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "重新生成总结失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
