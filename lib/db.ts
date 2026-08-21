import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

type D1Binding = ConstructorParameters<typeof PrismaD1>[0];

function createPrismaClient() {
  try {
    const { env } = getCloudflareContext();
    const db = (env as { DB?: D1Binding }).DB;
    if (db) {
      return new PrismaClient({
        adapter: new PrismaD1(db),
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
      });
    }
  } catch {
    // Local Next.js dev without Cloudflare bindings.
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
