import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import type { Database } from "@/lib/supabase/types";
import { DEMO, DEMO_ROLE_COOKIE, DEMO_EMAIL_COOKIE, demoSessionForRole } from "@/lib/demo";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

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

  let row: Awaited<ReturnType<typeof prisma.profiles.findUnique>>;
  try {
    row = await prisma.profiles.findUnique({ where: { id: user.id } });
  } catch (e) {
    console.error("[auth] profile lookup failed:", e instanceof Error ? e.message : e);
    return null;
  }

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

  if (profile?.blocked) return null;

  if (profile && profile.role !== "super_admin" && profile.company_id) {
    try {
      const company = await prisma.companies.findUnique({
        where: { id: profile.company_id },
        select: { blocked: true },
      });
      if (company?.blocked) return null;
    } catch (e) {
      console.error("[auth] company lookup failed:", e instanceof Error ? e.message : e);
      return null;
    }
  }

  return { userId: user.id, email: user.email ?? null, profile };
}
