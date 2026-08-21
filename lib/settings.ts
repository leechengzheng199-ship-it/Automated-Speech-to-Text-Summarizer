import { isDashscopeConfigured, type DashscopeSettings } from "@/lib/paraformer";
import { prisma } from "@/lib/db";
import { isLlmConfigured, type LlmSettings } from "@/lib/llm";
import { isQiniuConfigured, type QiniuSettings } from "@/lib/qiniu";
import { ensureDefaults } from "@/lib/seed";

export async function getAppSettings() {
  await ensureDefaults();
  const row = await prisma.settings.findUniqueOrThrow({ where: { id: "default" } });

  const qiniu: QiniuSettings = {
    accessKey: row.qiniuAccessKey,
    secretKey: row.qiniuSecretKey,
    bucket: row.qiniuBucket,
    domain: row.qiniuDomain,
    region: row.qiniuRegion,
    isPrivate: row.qiniuIsPrivate,
  };

  const dashscope: DashscopeSettings = {
    apiKey: row.dashscopeApiKey,
    model: row.dashscopeModel,
  };

  const llm: LlmSettings = {
    baseUrl: row.llmBaseUrl,
    apiKey: row.llmApiKey,
    model: row.llmModel,
  };

  return {
    qiniu,
    dashscope,
    llm,
    qiniuConfigured: isQiniuConfigured(qiniu),
    dashscopeConfigured: isDashscopeConfigured(dashscope),
    llmConfigured: isLlmConfigured(llm),
  };
}
