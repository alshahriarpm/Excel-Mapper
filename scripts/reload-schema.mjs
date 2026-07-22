/**
 * Tell PostgREST to reload its schema cache (fixes the PGRST002
 * "Could not query the database for the schema cache" state, e.g. after a
 * project wakes from pause). Connects via the session pooler — see
 * apply-schema.mjs for the required env (SUPABASE_PROJECT_REF /
 * SUPABASE_DB_PASSWORD / SUPABASE_REGION).
 */
import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const region = process.env.SUPABASE_REGION || "ap-south-1";
const port = Number(process.env.SUPABASE_DB_PORT) || 6543;

if (!ref || !password) {
  console.error("✗ Set SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD.");
  process.exit(1);
}

const hosts = [`aws-1-${region}.pooler.supabase.com`, `aws-0-${region}.pooler.supabase.com`];

let client;
for (const host of hosts) {
  try {
    client = new pg.Client({
      host,
      port,
      user: `postgres.${ref}`,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
    });
    await client.connect();
    console.log(`✓ connected via ${host}`);
    break;
  } catch (e) {
    console.log(`• ${host}: ${e.message}`);
    client = undefined;
  }
}
if (!client) {
  console.error("✗ Could not connect via any pooler host.");
  process.exit(1);
}

try {
  await client.query("notify pgrst, 'reload schema';");
  await client.query("notify pgrst, 'reload config';");
  console.log("✓ Sent PostgREST reload signals (schema + config).");
  console.log("  Give it a few seconds, then re-test the REST endpoint.");
} catch (e) {
  console.error("✗ Failed to signal PostgREST:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
