import { NextResponse } from "next/server";

/** Liveness probe that never touches Supabase (used by e2e webServer wait). */
export function GET() {
  return NextResponse.json({ ok: true });
}
