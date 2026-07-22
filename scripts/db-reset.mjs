/**
 * Guarded database reset. Destructive — asks for consent, twice, in order:
 *
 *   STEP 1: "Remove ALL DATA from all tables?"  (companies, templates,
 *            template versions, conversions)              → yes deletes, else skips
 *   STEP 2: "Remove ALL USER ACCOUNTS except super-admin?" → yes deletes, else skips
 *
 * The super-admin account is NEVER deleted. Each step is independent: you can
 * confirm one and skip the other. Requires an explicit "yes" for each.
 *
 * Run:  pnpm db:reset      (loads .env.local via node --env-file)
 *
 * Data deletion goes through the DIRECT pooler connection (like db:apply /
 * db:check) — NOT PostgREST — so it works even when the Data API is down.
 * User-account deletion still uses the Supabase Auth admin API (GoTrue); the
 * profile row is removed by ON DELETE CASCADE from auth.users.
 *
 * Safety: refuses to run without an interactive terminal (so it can't be driven
 * blindly by piped input / CI) and exits non-zero on any abort.
 */
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const ref = process.env.SUPABASE_PROJECT_REF;
const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const region = process.env.SUPABASE_REGION || "ap-south-1";
const port = Number(process.env.SUPABASE_DB_PORT) || 6543;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!url || !serviceKey) {
  fail("Missing NEXT_PUBLIC_SUPABASE_URL or a Supabase secret key (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY). Is .env.local set?");
}
if (!ref || !dbPassword) {
  fail("Missing SUPABASE_PROJECT_REF / SUPABASE_DB_PASSWORD — needed for direct data access. Is .env.local set?");
}

// Never run this destructive tool non-interactively (piped input, CI, `< /dev/null`),
// where prompts can't be answered and a partial/aborted wipe could look "successful".
if (!input.isTTY) {
  fail("Refusing to run non-interactively — a real terminal is required to confirm this destructive action.");
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function connectDb() {
  const hosts = [`aws-1-${region}.pooler.supabase.com`, `aws-0-${region}.pooler.supabase.com`];
  for (const host of hosts) {
    try {
      const client = new pg.Client({
        host,
        port,
        user: `postgres.${ref}`,
        password: dbPassword,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 12000,
      });
      await client.connect();
      return client;
    } catch (e) {
      console.log(`• ${host}: ${e.message}`);
    }
  }
  fail("Could not connect to the database via any pooler host.");
}

const rl = createInterface({ input, output });
let completed = false;
// If stdin closes (e.g. Ctrl+D) before we finish, treat it as an abort, not success.
rl.on("close", () => {
  if (!completed) {
    console.error("\n✗ Aborted — input closed before confirmation.");
    process.exit(1);
  }
});

async function consent(question) {
  const answer = (await rl.question(`${question}\n  Type "yes" to confirm (anything else skips): `))
    .trim()
    .toLowerCase();
  return answer === "yes";
}

async function main() {
  console.log("⚠  DATABASE RESET — permanently deletes data from your Supabase project.");
  console.log(`   Project: ${url}\n`);

  const db = await connectDb();

  try {
    // ---- STEP 1: all data from all tables -------------------------------------
    const removeData = await consent(
      'STEP 1 — Remove ALL DATA from all tables (companies, templates, template versions, conversions)?',
    );
    if (removeData) {
      // Child → parent order so FKs never block the delete. A single server-side
      // DELETE clears every matching row. (Deleting companies sets any HR user's
      // company_id to NULL via ON DELETE SET NULL; the accounts themselves are
      // only touched in STEP 2.)
      for (const table of ["conversions", "template_versions", "templates", "companies"]) {
        const res = await db.query(`delete from public.${table}`);
        console.log(`  ✓ Cleared ${table} (${res.rowCount} row(s) removed).`);
      }
    } else {
      console.log("  – Skipped: data left untouched.");
    }
    console.log("");

    // ---- STEP 2: all user accounts except super-admin -------------------------
    const removeUsers = await consent(
      'STEP 2 — Remove ALL USER ACCOUNTS except the super-admin(s)?',
    );
    if (removeUsers) {
      const { rows } = await db.query(
        `select id, email from public.profiles where role <> 'super_admin' order by created_at`,
      );
      let removed = 0;
      let failedCount = 0;
      for (const user of rows) {
        // GoTrue deletes the auth account; the profile row cascades from auth.users.
        const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
        if (deleteError) {
          console.warn(`  ! Could not delete ${user.email}: ${deleteError.message}`);
          failedCount++;
          continue;
        }
        removed++;
        console.log(`  ✓ Removed ${user.email}`);
      }
      console.log(
        `  ✓ Removed ${removed} user account(s)${failedCount ? `, ${failedCount} failed` : ""}. ` +
          `Super-admin(s) preserved.`,
      );
    } else {
      console.log("  – Skipped: user accounts left untouched.");
    }

    completed = true;
    rl.close();
    await db.end();
    console.log("\nDone.");
    process.exit(0);
  } catch (e) {
    completed = true;
    rl.close();
    try {
      await db.end();
    } catch {
      // ignore
    }
    fail(e?.message ?? String(e));
  }
}

main().catch((e) => {
  completed = true;
  rl.close();
  fail(e?.message ?? String(e));
});
