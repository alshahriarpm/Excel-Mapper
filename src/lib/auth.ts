import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import type { Database } from "@/lib/supabase/types";
import { DEMO, DEMO_ROLE_COOKIE, DEMO_EMAIL_COOKIE, demoSessionForRole } from "@/lib/demo";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Load the signed-in user and their profile (role + company).
 *
 * Identity comes from Supabase Auth (GoTrue); the profile row is read through
 * Prisma (direct DB), NOT PostgREST.
 */
export async function getSessionProfile(): Promise<{
  userId: string;
  email: string | null;
  profile: Profile | null;
} | null> {
  if (DEMO) {
    const cookieStore = await cookies();
    return demoSessionForRole(
      cookieStore.get(DEMO_ROLE_COOKIE)?.value,
      cookieStore.get(DEMO_EMAIL_COOKIE)?.value,
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const row = await prisma.profiles.findUnique({ where: { id: user.id } });
  const profile: Profile | null = row
    ? {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        role: row.role as Profile["role"],
        company_id: row.company_id,
        blocked: row.blocked,
        created_at: row.created_at.toISOString(),
      }
    : null;

  // A blocked account is treated as signed-out (belt-and-suspenders alongside
  // the Supabase Auth ban, which already blocks re-authentication).
  if (profile?.blocked) return null;

  // A blocked company locks out its members — but never the global super-admin.
  if (profile && profile.role !== "super_admin" && profile.company_id) {
    const company = await prisma.companies.findUnique({
      where: { id: profile.company_id },
      select: { blocked: true },
    });
    if (company?.blocked) return null;
  }

  return { userId: user.id, email: user.email ?? null, profile };
}
