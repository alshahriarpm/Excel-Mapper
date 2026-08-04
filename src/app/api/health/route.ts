import { NextResponse } from "next/server";

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

  try {
    const { prisma } = await import("@/lib/db");
    await prisma.$queryRaw`select 1`;
  } catch (e) {
    database = "failed";
    error = summarize(e);
  }

  const ok = database === "ok";
  return NextResponse.json({ ok, database, error, configured }, { status: ok ? 200 : 503 });
}
