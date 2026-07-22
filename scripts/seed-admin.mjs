/**
 * Seed (or repair) the super-admin account from environment variables.
 *
 * Run:  pnpm db:seed      (loads .env.local via node --env-file)
 *
 * Idempotent: if the user already exists it just ensures the super_admin role.
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY (or legacy
 *           SUPABASE_SERVICE_ROLE_KEY), SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD,
 *           (optional) SEED_ADMIN_NAME.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_ADMIN_EMAIL?.trim();
const password = process.env.SEED_ADMIN_PASSWORD;
const fullName = process.env.SEED_ADMIN_NAME?.trim() || "Administrator";

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!url || !serviceKey) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase secret key (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY). Is .env.local set?");
}
if (!email || !password) {
  fail("Missing SEED_ADMIN_EMAIL or SEED_ADMIN_PASSWORD in .env.local.");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(target) {
  const { data: profile } = await admin.from("profiles").select("id").eq("email", target).maybeSingle();
  if (profile?.id) return profile.id;
  // Fall back to scanning Auth users (handles the case where no profile exists yet).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function main() {
  console.log(`Seeding super-admin: ${email}`);

  let userId;
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "super_admin" },
  });

  if (error) {
    userId = await findUserIdByEmail(email);
    if (!userId) fail(`Could not create or locate the user: ${error.message}`);
    console.log("• User already existed — ensuring super_admin role.");
  } else {
    userId = created.user?.id;
    console.log("• Auth account created.");
  }

  // Upsert (not update) so a missing profile row is created rather than a
  // zero-row update silently reporting success; assert a row was actually written.
  const { data: written, error: upsertError } = await admin
    .from("profiles")
    .upsert({ id: userId, email, full_name: fullName, role: "super_admin" }, { onConflict: "id" })
    .select("id");
  if (upsertError) {
    fail(`Auth account is ready but writing the profile failed: ${upsertError.message}. ` +
      `Has the schema been applied (supabase/schema.sql)?`);
  }
  if (!written || written.length === 0) {
    fail("Profile row was not written — the super_admin role is NOT set. Check the schema and RLS.");
  }

  console.log(`✓ Super-admin ready. Sign in with: ${email}`);
  process.exit(0);
}

main().catch((e) => fail(e?.message ?? String(e)));
