-- Initial schema for Cloudflare D1. Run once after creating the D1 database:
-- pnpm exec wrangler d1 execute speech-summarizer --remote --file=./prisma/d1-init.sql

CREATE TABLE IF NOT EXISTS "Settings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "qiniuAccessKey" TEXT NOT NULL DEFAULT '',
  "qiniuSecretKey" TEXT NOT NULL DEFAULT '',
  "qiniuBucket" TEXT NOT NULL DEFAULT '',
  "qiniuDomain" TEXT NOT NULL DEFAULT '',
  "qiniuRegion" TEXT NOT NULL DEFAULT 'z0',
  "qiniuIsPrivate" INTEGER NOT NULL DEFAULT 0,
  "dashscopeApiKey" TEXT NOT NULL DEFAULT '',
  "dashscopeModel" TEXT NOT NULL DEFAULT 'paraformer-v2',
  "llmBaseUrl" TEXT NOT NULL DEFAULT '',
  "llmApiKey" TEXT NOT NULL DEFAULT '',
  "llmModel" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Template" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "systemPrompt" TEXT NOT NULL,
  "outputLanguage" TEXT NOT NULL DEFAULT 'zh',
  "sections" TEXT NOT NULL,
  "isBuiltin" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Job" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "durationMs" INTEGER,
  "kodoKey" TEXT,
  "audioUrl" TEXT,
  "asrTaskId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "errorMessage" TEXT,
  "templateId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Transcript" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "resultText" TEXT NOT NULL,
  "detail" TEXT NOT NULL DEFAULT '[]',
  "durationMs" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Transcript_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Transcript_jobId_key" ON "Transcript"("jobId");

CREATE TABLE IF NOT EXISTS "Summary" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "jobId" TEXT NOT NULL,
  "templateId" TEXT,
  "templateSnapshot" TEXT NOT NULL,
  "markdown" TEXT NOT NULL,
  "rawOutput" TEXT NOT NULL DEFAULT '',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Summary_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Summary_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Summary_jobId_key" ON "Summary"("jobId");
