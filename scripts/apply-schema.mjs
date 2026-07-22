/**
 * Apply supabase/schema.sql to the database via the Supabase connection pooler
 * (IPv4, works when the direct db.* host is IPv6-only), then signal PostgREST
 * to reload its schema cache.
 *
 * Credentials come from env (never hard-coded):
 *   SUPABASE_PROJECT_REF   e.g. vjtnowmsmjzjdqsqtbyi
 *   SUPABASE_DB_PASSWORD   the database password
 *   SUPABASE_REGION        e.g. ap-south-1 (default)
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const region = process.env.SUPABASE_REGION || "ap-south-1";
// Pooler port: 6543 = transaction pooler (default), 5432 = session pooler.
// NOTE: multi-statement DDL needs the SESSION pooler — if applying the schema
// over 6543 fails, set SUPABASE_DB_PORT=5432.
const port = Number(process.env.SUPABASE_DB_PORT) || 6543;

if (!ref || !password) {
  console.error("✗ Set SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD.");
  process.exit(1);
}

const hosts = [`aws-1-${region}.pooler.supabase.com`, `aws-0-${region}.pooler.supabase.com`];
const schemaSql = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");

async function connect(host) {
  const client = new pg.Client({
    host,
    port,
    user: `postgres.${ref}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 12000,
  });
  await client.connect();
  return client;
}

let client;
let usedHost;
for (const host of hosts) {
  try {
    client = await connect(host);
    usedHost = host;
    break;
  } catch (e) {
    console.log(`• ${host}: ${e.message}`);
  }
}
if (!client) {
  console.error("✗ Could not connect via any pooler host.");
  process.exit(1);
}
console.log(`✓ Connected via ${usedHost} as postgres.${ref}`);

try {
  console.log("Applying schema…");
  await client.query(schemaSql);
  console.log("✓ Schema applied.");

  await client.query("notify pgrst, 'reload schema';");
  console.log("✓ Sent PostgREST schema-reload signal.");

  const { rows } = await client.query(
    "select tablename from pg_tables where schemaname = 'public' order by tablename;",
  );
  console.log("Public tables now present:", rows.map((r) => r.tablename).join(", ") || "(none)");
} catch (e) {
  console.error("✗ SQL error:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
