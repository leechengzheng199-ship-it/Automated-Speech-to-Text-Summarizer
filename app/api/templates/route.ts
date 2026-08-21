import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { ensureDefaults } from "@/lib/seed";
import { defaultNewTemplate, parseTemplateInput } from "@/lib/templates";

export const dynamic = "force-dynamic";

function serialize(template: { sections: string } & Record<string, unknown>) {
  return {
    ...template,
    sections: JSON.parse(template.sections),
  };
}

export async function GET() {
  await ensureDefaults();
  const templates = await prisma.template.findMany({
    orderBy: [{ isBuiltin: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(templates.map(serialize));
}

export async function POST(request: Request) {
  await ensureDefaults();
  try {
    const raw = await request.json().catch(() => null);
    const payload =
      raw && typeof raw === "object" && Object.keys(raw as object).length > 0
        ? parseTemplateInput(raw)
        : defaultNewTemplate();
    const created = await prisma.template.create({
      data: {
        name: payload.name,
        description: payload.description,
        systemPrompt: payload.systemPrompt,
        outputLanguage: payload.outputLanguage,
        sections: JSON.stringify(payload.sections),
        isBuiltin: false,
      },
    });
    return NextResponse.json(serialize(created), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建模板失败。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
