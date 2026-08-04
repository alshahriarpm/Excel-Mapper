import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ErrorSummary = { name: string; code?: string; message: string };

function scrub(message: string): string {
  return message
    .replace(/postgres(?:ql)?:\/\/[^@\s]*@/gi, "postgresql://***:***@")
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "sb_***")
    .slice(0, 400);
}

function summarize(error: unknown): ErrorSummary {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      name: error.name,
      code: typeof code === "string" ? code : undefined,
      message: scrub(error.message),
    };
  }
  return { name: "Unknown", message: scrub(String(error)) };
}

function authProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return (url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] ?? null;
}

function dbProjectRef(): string | null {
  const direct = process.env.DATABASE_URL;
  if (direct) {
    return (direct.match(/\/\/postgres\.([a-z0-9]+):/) || [])[1] ?? "unparsed";
  }
  return process.env.SUPABASE_PROJECT_REF ?? null;
}

export async function GET() {
  const configured = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    SUPABASE_PROJECT_REF: Boolean(process.env.SUPABASE_PROJECT_REF),
    SUPABASE_DB_PASSWORD: Boolean(process.env.SUPABASE_DB_PASSWORD),
    SUPABASE_REGION: process.env.SUPABASE_REGION ?? null,
    SUPABASE_DB_PORT: process.env.SUPABASE_DB_PORT ?? null,
    NEXT_PUBLIC_SUPABASE_URL: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SECRET_KEY: Boolean(
      process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    NODE_ENV: process.env.NODE_ENV,
  };

  let database: "ok" | "failed" = "ok";
  let error: ErrorSummary | undefined;
  let profilesTable: "ok" | "failed" | "unknown" = "unknown";
  let hasAnyProfiles: boolean | null = null;

  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`select 1`;
    try {
      hasAnyProfiles = (await prisma.profiles.count()) > 0;
      profilesTable = "ok";
    } catch (e) {
      profilesTable = "failed";
      error = summarize(e);
    }
  } catch (e) {
    database = "failed";
    error = summarize(e);
  }

  const project = {
    authProjectRef: authProjectRef(),
    dbProjectRef: dbProjectRef(),
    sameProject: authProjectRef() !== null && authProjectRef() === dbProjectRef(),
  };

  const session: Record<string, unknown> = { authenticated: false };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      session.authenticated = true;
      session.userIdPrefix = user.id.slice(0, 8);
      session.jwtMetadataRole = (user.user_metadata as { role?: unknown } | null)?.role ?? null;
      const { prisma } = await import("@/lib/db");
      const row = await prisma.profiles.findUnique({
        where: { id: user.id },
        select: { role: true, company_id: true, blocked: true },
      });
      session.hasProfileRow = Boolean(row);
      session.profileRole = row?.role ?? null;
      session.hasCompany = Boolean(row?.company_id);
      session.blocked = row?.blocked ?? null;
      session.wouldRedirectTo =
        row?.role === "super_admin" ? "/admin" : row?.role === "hr" ? "/hr" : "(no role — stays on /)";
    }
  } catch (e) {
    session.error = summarize(e);
  }

  const ok = database === "ok" && profilesTable === "ok";
  return NextResponse.json(
    { ok, database, profilesTable, hasAnyProfiles, project, session, error, configured },
    { status: ok ? 200 : 503 },
  );
}
