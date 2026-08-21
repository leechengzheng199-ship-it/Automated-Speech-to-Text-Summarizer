import { NextResponse } from "next/server";

import { testParaformerAccess } from "@/lib/paraformer";
import { getAppSettings } from "@/lib/settings";

export async function POST() {
  const settings = await getAppSettings();
  if (!settings.dashscopeConfigured) {
    return NextResponse.json(
      { ok: false, message: "请先保存阿里云百炼 API Key。" },
      { status: 400 },
    );
  }

  const result = await testParaformerAccess(settings.dashscope);
  return NextResponse.json(result);
}
