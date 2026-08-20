import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <p className="mt-1 text-muted-foreground">
          自定义章节标题、抽取说明与输出格式。生成总结时会把章节拼成固定 Markdown 大纲。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {templates.map((template) => {
          const sections = JSON.parse(template.sections) as TemplateSection[];
          return (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{template.name}</CardTitle>
                  {template.isBuiltin ? <Badge variant="secondary">内置</Badge> : <Badge variant="outline">自定义</Badge>}
                </div>
                <CardDescription>{template.description || "未填写说明"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="list-decimal space-y-2 pl-5 text-sm">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <span className="font-medium">{section.title}</span>
                      <span className="text-muted-foreground"> · {section.format}</span>
                      <p className="mt-0.5 text-muted-foreground">{section.instruction}</p>
                    </li>
                  ))}
                </ol>
                <p className="text-xs text-muted-foreground">可视化编辑将在模板迭代中开放，当前可在数据库或后续界面中修改。</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
