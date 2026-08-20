import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isQiniuConfigured } from "@/lib/qiniu";
import { ensureDefaults } from "@/lib/seed";

export async function POST() {
  await ensureDefaults();
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "default" } });
  const configured = isQiniuConfigured({
    accessKey: settings.qiniuAccessKey,
    secretKey: settings.qiniuSecretKey,
    bucket: settings.qiniuBucket,
    domain: settings.qiniuDomain,
    region: settings.qiniuRegion,
    isPrivate: settings.qiniuIsPrivate,
  });

  if (!configured) {
    return NextResponse.json(
      { error: "请先在设置页填写七牛云 AccessKey、SecretKey、Bucket 和访问域名。" },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { error: "上传凭证签发将在后续迭代接入七牛 SDK。" },
    { status: 501 },
  );
}
