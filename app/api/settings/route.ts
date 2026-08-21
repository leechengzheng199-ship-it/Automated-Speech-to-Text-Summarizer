import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { isDashscopeConfigured } from "@/lib/paraformer";
import { isLlmConfigured } from "@/lib/llm";
import { isQiniuConfigured } from "@/lib/qiniu";
import { ensureDefaults } from "@/lib/seed";
import { MASKED_SECRET } from "@/lib/types";

export const dynamic = "force-dynamic";

function serializeSettings(settings: {
  qiniuAccessKey: string;
  qiniuSecretKey: string;
  qiniuBucket: string;
  qiniuDomain: string;
  qiniuRegion: string;
  qiniuIsPrivate: boolean;
  dashscopeApiKey: string;
  dashscopeModel: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
}) {
  return {
    qiniuAccessKey: settings.qiniuAccessKey,
    qiniuSecretKey: settings.qiniuSecretKey ? MASKED_SECRET : "",
    qiniuBucket: settings.qiniuBucket,
    qiniuDomain: settings.qiniuDomain,
    qiniuRegion: settings.qiniuRegion,
    qiniuIsPrivate: settings.qiniuIsPrivate,
    dashscopeApiKey: settings.dashscopeApiKey ? MASKED_SECRET : "",
    dashscopeModel: settings.dashscopeModel,
    llmBaseUrl: settings.llmBaseUrl,
    llmApiKey: settings.llmApiKey ? MASKED_SECRET : "",
    llmModel: settings.llmModel,
    qiniuConfigured: isQiniuConfigured({
      accessKey: settings.qiniuAccessKey,
      secretKey: settings.qiniuSecretKey,
      bucket: settings.qiniuBucket,
      domain: settings.qiniuDomain,
      region: settings.qiniuRegion,
      isPrivate: settings.qiniuIsPrivate,
    }),
    dashscopeConfigured: isDashscopeConfigured({
      apiKey: settings.dashscopeApiKey,
      model: settings.dashscopeModel,
    }),
    llmConfigured: isLlmConfigured({
      baseUrl: settings.llmBaseUrl,
      apiKey: settings.llmApiKey,
      model: settings.llmModel,
    }),
  };
}

function nextSecret(incoming: unknown, current: string) {
  return typeof incoming === "string" && incoming.length > 0 && incoming !== MASKED_SECRET
    ? incoming
    : current;
}

export async function GET() {
  await ensureDefaults();
  const settings = await prisma.settings.findUniqueOrThrow({ where: { id: "default" } });
  return NextResponse.json(serializeSettings(settings));
}

export async function PUT(request: Request) {
  await ensureDefaults();
  const body = (await request.json()) as Record<string, unknown>;
  const current = await prisma.settings.findUniqueOrThrow({ where: { id: "default" } });

  const settings = await prisma.settings.update({
    where: { id: "default" },
    data: {
      qiniuAccessKey: String(body.qiniuAccessKey ?? current.qiniuAccessKey),
      qiniuSecretKey: nextSecret(body.qiniuSecretKey, current.qiniuSecretKey),
      qiniuBucket: String(body.qiniuBucket ?? current.qiniuBucket),
      qiniuDomain: String(body.qiniuDomain ?? current.qiniuDomain),
      qiniuRegion: String(body.qiniuRegion ?? current.qiniuRegion),
      qiniuIsPrivate: Boolean(body.qiniuIsPrivate),
      dashscopeApiKey: nextSecret(body.dashscopeApiKey, current.dashscopeApiKey),
      dashscopeModel: String(body.dashscopeModel ?? current.dashscopeModel) || "paraformer-v2",
      llmBaseUrl: String(body.llmBaseUrl ?? current.llmBaseUrl),
      llmApiKey: nextSecret(body.llmApiKey, current.llmApiKey),
      llmModel: String(body.llmModel ?? current.llmModel),
    },
  });

  return NextResponse.json(serializeSettings(settings));
}
