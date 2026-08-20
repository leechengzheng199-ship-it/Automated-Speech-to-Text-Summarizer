import { prisma } from "@/lib/db";
import { BUILTIN_TEMPLATES } from "@/lib/templates";

export async function ensureDefaults() {
  await prisma.settings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });

  const templateCount = await prisma.template.count();
  if (templateCount === 0) {
    await prisma.template.createMany({
      data: BUILTIN_TEMPLATES.map((template) => ({
        name: template.name,
        description: template.description,
        systemPrompt: template.systemPrompt,
        outputLanguage: template.outputLanguage,
        isBuiltin: template.isBuiltin,
        sections: JSON.stringify(template.sections),
      })),
    });
  }
}
