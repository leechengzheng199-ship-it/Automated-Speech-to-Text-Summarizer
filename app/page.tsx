import { JobList } from "@/components/job-list";
import { UploadDropzone } from "@/components/upload-dropzone";
import { prisma } from "@/lib/db";
import { ensureDefaults } from "@/lib/seed";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  await ensureDefaults();
  const jobs = await prisma.job.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">工作台</h1>
        <p className="mt-1 text-muted-foreground">
          上传本地录音，解析压缩后交给七牛云转写，再按你的模板生成结构化总结。
        </p>
      </div>
      <UploadDropzone />
      <section className="space-y-3">
        <h2 className="text-lg font-medium">最近任务</h2>
        <JobList jobs={jobs} />
      </section>
    </div>
  );
}
