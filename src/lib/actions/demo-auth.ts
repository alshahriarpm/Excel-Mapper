"use server";

import { cookies } from "next/headers";
import { DEMO, DEMO_ROLE_COOKIE, DEMO_EMAIL_COOKIE } from "@/lib/demo";

export async function signInDemo(
  email: string,
  password: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!DEMO) return { ok: false, error: "Demo mode is disabled." };

  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm) return { ok: false, error: "Please enter your email." };

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "";

  let role: "super_admin" | "hr";
  if (adminEmail && emailNorm === adminEmail) {
    if (adminPassword && password !== adminPassword) {
      return { ok: false, error: "Incorrect password." };
    }
    role = "super_admin";
  } else {
    role = "hr";
  }

  const store = await cookies();
  const opts = { httpOnly: true, sameSite: "lax" as const, path: "/" };
  store.set(DEMO_ROLE_COOKIE, role, opts);
  store.set(DEMO_EMAIL_COOKIE, email.trim(), opts);
  return { ok: true };
}
