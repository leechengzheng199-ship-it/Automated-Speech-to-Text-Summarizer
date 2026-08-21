import { JobList } from "@/components/job-list";
import { UploadDropzone } from "@/components/upload-dropzone";
import { prisma } from "@/lib/db";
import { getAppSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getAppSettings();
  const [jobs, templates] = await Promise.all([
    prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.template.findMany({
      orderBy: [{ isBuiltin: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">工作台</h1>
        <p className="mt-1 text-muted-foreground">
          上传本地录音，存到七牛后用阿里云 Paraformer 转写，再按你的模板生成结构化总结。
        </p>
      </div>
      <UploadDropzone
        qiniuConfigured={settings.qiniuConfigured}
        dashscopeConfigured={settings.dashscopeConfigured}
        llmConfigured={settings.llmConfigured}
        templates={templates}
      />
      <section className="space-y-3">
        <h2 className="text-lg font-medium">最近任务</h2>
        <JobList jobs={jobs} />
      </section>
    </div>
  );
}
