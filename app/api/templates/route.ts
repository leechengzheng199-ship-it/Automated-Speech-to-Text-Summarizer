import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { ensureDefaults } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDefaults();
  const templates = await prisma.template.findMany({
    orderBy: [{ isBuiltin: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(
    templates.map((template) => ({
      ...template,
      sections: JSON.parse(template.sections),
    })),
  );
}
