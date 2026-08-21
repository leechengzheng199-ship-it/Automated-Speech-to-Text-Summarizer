import { notFound } from "next/navigation";

import { JobDetail } from "@/components/job-detail";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!job) {
    notFound();
  }

  return <JobDetail jobId={id} />;
}
