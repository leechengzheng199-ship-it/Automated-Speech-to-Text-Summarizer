import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
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
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
}) {
  const qiniuConfigured = isQiniuConfigured({
    accessKey: settings.qiniuAccessKey,
    secretKey: settings.qiniuSecretKey,
    bucket: settings.qiniuBucket,
    domain: settings.qiniuDomain,
    region: settings.qiniuRegion,
    isPrivate: settings.qiniuIsPrivate,
  });
  const llmConfigured = isLlmConfigured({
    baseUrl: settings.llmBaseUrl,
    apiKey: settings.llmApiKey,
    model: settings.llmModel,
  });

  return {
    qiniuAccessKey: settings.qiniuAccessKey,
    qiniuSecretKey: settings.qiniuSecretKey ? MASKED_SECRET : "",
    qiniuBucket: settings.qiniuBucket,
    qiniuDomain: settings.qiniuDomain,
    qiniuRegion: settings.qiniuRegion,
    qiniuIsPrivate: settings.qiniuIsPrivate,
    llmBaseUrl: settings.llmBaseUrl,
    llmApiKey: settings.llmApiKey ? MASKED_SECRET : "",
    llmModel: settings.llmModel,
    qiniuConfigured,
    llmConfigured,
  };
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

  const nextSecret =
    typeof body.qiniuSecretKey === "string" &&
    body.qiniuSecretKey.length > 0 &&
    body.qiniuSecretKey !== MASKED_SECRET
      ? body.qiniuSecretKey
      : current.qiniuSecretKey;

  const nextLlmKey =
    typeof body.llmApiKey === "string" &&
    body.llmApiKey.length > 0 &&
    body.llmApiKey !== MASKED_SECRET
      ? body.llmApiKey
      : current.llmApiKey;

  const settings = await prisma.settings.update({
    where: { id: "default" },
    data: {
      qiniuAccessKey: String(body.qiniuAccessKey ?? current.qiniuAccessKey),
      qiniuSecretKey: nextSecret,
      qiniuBucket: String(body.qiniuBucket ?? current.qiniuBucket),
      qiniuDomain: String(body.qiniuDomain ?? current.qiniuDomain),
      qiniuRegion: String(body.qiniuRegion ?? current.qiniuRegion),
      qiniuIsPrivate: Boolean(body.qiniuIsPrivate),
      llmBaseUrl: String(body.llmBaseUrl ?? current.llmBaseUrl),
      llmApiKey: nextLlmKey,
      llmModel: String(body.llmModel ?? current.llmModel),
    },
  });

  return NextResponse.json(serializeSettings(settings));
}
