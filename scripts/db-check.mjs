/** Deep PostgREST diagnostic via the pooler (see apply-schema.mjs for env). */
import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
const region = process.env.SUPABASE_REGION || "ap-south-1";
const port = Number(process.env.SUPABASE_DB_PORT) || 6543;
const hosts = [`aws-1-${region}.pooler.supabase.com`, `aws-0-${region}.pooler.supabase.com`];

let client;
for (const host of hosts) {
  try {
    client = new pg.Client({ host, port, user: `postgres.${ref}`, password, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 12000 });
    await client.connect();
    console.log(`✓ connected via ${host}`);
    break;
  } catch (e) { console.log(`• ${host}: ${e.message}`); client = undefined; }
}
if (!client) process.exit(1);

async function q(label, sql) {
  try { const r = await client.query(sql); console.log(`\n### ${label}`); console.table(r.rows); return r.rows; }
  catch (e) { console.log(`\n### ${label}\n  ERROR: ${e.message}`); return null; }
}

try {
  await q("PostgREST backends (age_s = seconds since it (re)started)",
    `select application_name, state, extract(epoch from (now()-backend_start))::int as age_s
       from pg_stat_activity where application_name ilike 'PostgREST%' order by backend_start;`);

  await q("authenticator role memberships (needs anon/authenticated/service_role)",
    `select r.rolname as is_member_of
       from pg_auth_members am
       join pg_roles r on r.oid = am.roleid
       join pg_roles m on m.oid = am.member
      where m.rolname = 'authenticator';`);

  await q("role timeouts / config",
    `select rolname, rolconfig from pg_roles where rolname in ('authenticator','anon','authenticated','service_role');`);

  // Reproduce what PostgREST does: connect-as-authenticator then switch roles.
  console.log("\n### role-switch test (what PostgREST does per request)");
  for (const role of ["authenticator", "anon", "authenticated", "service_role"]) {
    try { await client.query(`set role ${role}`); await client.query("reset role"); console.log(`  set role ${role}: OK`); }
    catch (e) { console.log(`  set role ${role}: FAIL ${e.message}`); await client.query("reset role").catch(() => {}); }
  }

  await q("invalid objects that could break introspection",
    `select 'view' as kind, n.nspname||'.'||c.relname as obj
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where c.relkind='v' and n.nspname='public'
        and pg_get_viewdef(c.oid) is null;`);
} finally { await client.end(); }
