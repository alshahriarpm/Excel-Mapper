import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEMO, DEMO_ROLE_COOKIE, DEMO_EMAIL_COOKIE } from "@/lib/demo";

export async function POST(request: Request) {
  const res = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  if (DEMO) {
    res.cookies.delete(DEMO_ROLE_COOKIE);
    res.cookies.delete(DEMO_EMAIL_COOKIE);
    return res;
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  return res;
}
