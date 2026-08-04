import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import type { Database } from "@/lib/supabase/types";
import { DEMO, DEMO_ROLE_COOKIE, DEMO_EMAIL_COOKIE, demoSessionForRole } from "@/lib/demo";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type SessionProfile = {
  userId: string;
  email: string | null;
  profile: Profile | null;
};

export type SessionReason =
  | "ok"
  | "demo-no-role"
  | "no-user"
  | "profile-error"
  | "blocked"
  | "company-error";

export async function getSessionProfile(): Promise<SessionProfile | null> {
  return (await getSessionOutcome()).session;
}

async function findProfile(userId: string) {
  try {
    return await prisma.profiles.findUnique({ where: { id: userId } });
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return await prisma.profiles.findUnique({ where: { id: userId } });
  }
}

export async function getSessionOutcome(): Promise<{
  session: SessionProfile | null;
  reason: SessionReason;
}> {
  if (DEMO) {
    const cookieStore = await cookies();
    const demo = demoSessionForRole(
      cookieStore.get(DEMO_ROLE_COOKIE)?.value,
      cookieStore.get(DEMO_EMAIL_COOKIE)?.value,
    );
    return { session: demo, reason: demo ? "ok" : "demo-no-role" };
  }
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) {
    if (userError && userError.name !== "AuthSessionMissingError") {
      console.error("[auth] getUser failed:", userError.name, userError.message);
    }
    return { session: null, reason: "no-user" };
  }

  let row: Awaited<ReturnType<typeof prisma.profiles.findUnique>>;
  try {
    row = await findProfile(user.id);
  } catch (e) {
    console.error("[auth] profile lookup failed:", e instanceof Error ? e.message : e);
    return { session: null, reason: "profile-error" };
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

  if (profile?.blocked) return { session: null, reason: "blocked" };

  if (profile && profile.role !== "super_admin" && profile.company_id) {
    try {
      const company = await prisma.companies.findUnique({
        where: { id: profile.company_id },
        select: { blocked: true },
      });
      if (company?.blocked) return { session: null, reason: "blocked" };
    } catch (e) {
      console.error("[auth] company lookup failed:", e instanceof Error ? e.message : e);
      return { session: null, reason: "company-error" };
    }
  }

  return {
    session: { userId: user.id, email: user.email ?? null, profile },
    reason: "ok",
  };
}
