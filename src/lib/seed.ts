import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { prisma } from "@/lib/db";
import { validatePassword } from "@/lib/password";

let attempted = false;

const USERS_PER_PAGE = 200;
const MAX_USER_PAGES = 25;

async function findAuthUserId(
  admin: SupabaseClient<Database>,
  email: string,
): Promise<string | null> {
  const wanted = email.toLowerCase();
  for (let page = 1; page <= MAX_USER_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USERS_PER_PAGE });
    if (error || !data.users.length) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === wanted);
    if (match) return match.id;
    if (data.users.length < USERS_PER_PAGE) return null;
  }
  return null;
}

export async function seedAdminFromEnv(): Promise<void> {
  const demoActive =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" &&
    process.env.NODE_ENV !== "production";
  if (demoActive) return;

  if (attempted) return;
  attempted = true;

  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fullName = process.env.SEED_ADMIN_NAME?.trim() || "Administrator";

  if (!email || !password) return;

  const weak = validatePassword(password);
  if (weak) {
    console.warn(
      `[seed] SEED_ADMIN_PASSWORD is weak (${weak}) — please use a stronger password.`,
    );
  }
  if (!url || !serviceKey) {
    console.warn(
      "[seed] SEED_ADMIN_* set but Supabase URL / secret key missing — skipping. " +
        "Set SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY).",
    );
    return;
  }

  const admin = createClient<Database>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    let userId: string | undefined;

    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "super_admin" },
    });

    if (error) {
      const existing = await prisma.profiles.findFirst({
        where: { email },
        select: { id: true },
      });
      userId = existing?.id ?? (await findAuthUserId(admin, email)) ?? undefined;
      if (!userId) {
        console.warn(
          `[seed] could not create or find admin "${email}": ${error.message}`,
        );
        return;
      }
      console.log(
        `[seed] admin "${email}" already exists — ensuring profile row and super_admin role.`,
      );
    } else {
      userId = created.user?.id;
      console.log(`[seed] created admin "${email}".`);
    }

    if (userId) {
      await prisma.profiles.upsert({
        where: { id: userId },
        create: { id: userId, email, full_name: fullName, role: "super_admin" },
        update: { role: "super_admin", full_name: fullName },
      });
    }
  } catch (e) {
    console.error("[seed] failed:", e instanceof Error ? e.message : e);
  }
}
