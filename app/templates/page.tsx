import { TemplateManager } from "@/components/template-manager";
import { prisma } from "@/lib/db";
import { ensureDefaults } from "@/lib/seed";
import type { TemplateSection } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  await ensureDefaults();
  const templates = await prisma.template.findMany({
    orderBy: [{ isBuiltin: "desc" }, { createdAt: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">总结模板</h1>
        <p className="mt-1 text-muted-foreground">点编辑可改章节和总结要求。工作台会按保存后的模板生成总结。</p>
      </div>
      <TemplateManager
        initialTemplates={templates.map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          systemPrompt: template.systemPrompt,
          outputLanguage: template.outputLanguage,
          isBuiltin: template.isBuiltin,
          sections: JSON.parse(template.sections) as TemplateSection[],
        }))}
      />
    </div>
  );
}
