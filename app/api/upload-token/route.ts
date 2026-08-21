import { NextResponse } from "next/server";

import { createUploadToken, getUploadHost } from "@/lib/qiniu";
import { getAppSettings } from "@/lib/settings";

function sanitizeFileName(fileName: string) {
  const base = fileName.replace(/[\\/]/g, "_").replace(/\s+/g, "_").slice(0, 80);
  return base || "audio";
}

export async function POST(request: Request) {
  const settings = await getAppSettings();
  if (!settings.qiniuConfigured) {
    return NextResponse.json(
      { error: "请先在设置页填写七牛云 AccessKey、SecretKey、Bucket 和访问域名。" },
      { status: 400 },
    );
  }

  const body = (await request.json()) as { fileName?: string };
  if (!body.fileName) {
    return NextResponse.json({ error: "缺少 fileName。" }, { status: 400 });
  }

  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const key = `speech/${stamp}/${Date.now()}-${sanitizeFileName(body.fileName)}`;
  const token = createUploadToken(settings.qiniu, key);

  return NextResponse.json({
    token,
    key,
    uploadUrl: getUploadHost(settings.qiniu.region),
  });
}
