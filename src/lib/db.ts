import "server-only";
import { PrismaClient } from "@prisma/client";

function connectionUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const ref = process.env.SUPABASE_PROJECT_REF;
  const password = process.env.SUPABASE_DB_PASSWORD;
  const region = process.env.SUPABASE_REGION || "ap-south-1";
  const port = process.env.SUPABASE_DB_PORT || "6543";
  if (!ref || !password) {
    throw new Error(
      "Prisma: set DATABASE_URL, or SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD (+ SUPABASE_REGION).",
    );
  }
  const host = process.env.SUPABASE_POOLER_HOST || `aws-1-${region}.pooler.supabase.com`;
  const pw = encodeURIComponent(password);
  return `postgresql://postgres.${ref}:${pw}@${host}:${port}/postgres?pgbouncer=true&sslmode=require&connection_limit=1`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: connectionUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
