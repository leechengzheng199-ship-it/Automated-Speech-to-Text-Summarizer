import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { builtinDefaultsFor, parseTemplateInput } from "@/lib/templates";

export const dynamic = "force-dynamic";

function serialize(template: { sections: string } & Record<string, unknown>) {
  return {
    ...template,
    sections: JSON.parse(template.sections),
  };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.template.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "模板不存在。" }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as { reset?: boolean } | null;
  try {
    const source = body?.reset ? builtinDefaultsFor(existing.name) : null;
    if (body?.reset && !source) {
      throw new Error("只有未改名的内置模板可以恢复默认。");
    }
    const payload = source
      ? {
          name: source.name,
          description: source.description,
          systemPrompt: source.systemPrompt,
          outputLanguage: source.outputLanguage,
          sections: source.sections,
        }
      : parseTemplateInput(body);

    const updated = await prisma.template.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description,
        systemPrompt: payload.systemPrompt,
        outputLanguage: payload.outputLanguage,
        sections: JSON.stringify(payload.sections),
      },
    });
    return NextResponse.json(serialize(updated));
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存模板失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const existing = await prisma.template.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "模板不存在。" }, { status: 404 });
  }

  const remaining = await prisma.template.count();
  if (remaining <= 1) {
    return NextResponse.json({ error: "至少保留一个总结模板。" }, { status: 400 });
  }

  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
