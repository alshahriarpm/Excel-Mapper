import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Build the Postgres connection string for Prisma.
 *
 * Prefers an explicit DATABASE_URL (e.g. copied from the Supabase dashboard).
 * Otherwise it is assembled from the same SUPABASE_* vars the DB scripts use,
 * so there is only one place to keep the credentials.
 *
 * Runtime uses the pooler: 6543 = transaction pooler (default, needs
 * pgbouncer=true so Prisma disables prepared statements); set SUPABASE_DB_PORT
 * to 5432 for the session pooler.
 */
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

// Reuse a single client across HMR reloads in dev to avoid exhausting pool slots.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: connectionUrl() });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
