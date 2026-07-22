# Setup guide

This app needs a Supabase project (database + auth) to run. Everything else is
in the repo. Budget ~10 minutes.

## 1. Install dependencies

```bash
pnpm install
```

## 2. Create a Supabase project

1. Go to <https://supabase.com> → **New project**. Pick a region close to you.
2. Once created, open **Project Settings → API** and copy:
   - **Project URL**
   - **Publishable key** (`sb_publishable_…`) — or the legacy **anon public** key
   - **Secret key** (`sb_secret_…`, server only) — or the legacy **service_role** key

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...                 # Project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...     # publishable key (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)
SUPABASE_SECRET_KEY=...                       # secret key, server only (or legacy SUPABASE_SERVICE_ROLE_KEY)
NEXT_PUBLIC_SITE_URL=http://localhost:3000    # base URL for deploy-time auth redirects

# Only needed for the direct-DB scripts (pnpm db:apply / db:check / db:reload):
SUPABASE_PROJECT_REF=your-project-ref
SUPABASE_DB_PASSWORD=your-db-password         # DB password (NOT the sb_secret_ key)
SUPABASE_REGION=ap-south-1
```

## 4. Create the database schema

Open the Supabase **SQL Editor** and run **each file in
[`supabase/migrations/`](supabase/migrations) in order**:

1. `0001_init.sql` — tables, RLS policies, and the new-user profile trigger.
2. `0002_user_blocking.sql` — adds the `blocked` flag on users.
3. `0003_company_blocking.sql` — adds the `blocked` flag on companies.

> Prefer one command? With `SUPABASE_PROJECT_REF` / `SUPABASE_DB_PASSWORD` /
> `SUPABASE_REGION` set in `.env.local`, run **`pnpm db:apply`** — it applies
> `supabase/schema.sql` (equivalent to all migrations in order) and reloads the
> PostgREST schema cache. Using the Supabase CLI instead? `supabase link` then
> `supabase db push`.

## 5. Turn off email confirmation (for password login during setup)

**Authentication → Providers → Email**: ensure **Email** is enabled. Under
**Authentication → Settings**, you can disable "Confirm email" so password
accounts work immediately (or configure SMTP if you want confirmations).

## 6. Seed your Super Admin (from env — automatic on startup)

Set these in `.env.local`, then start the app — a super-admin is created
automatically on server startup (idempotent; safe to leave set):

```
SEED_ADMIN_EMAIL=you@company.com
SEED_ADMIN_PASSWORD=choose-a-strong-password
SEED_ADMIN_NAME=Administrator
```

The role is derived from the account — you sign in with this email/password and
land in the Admin Studio; there is no role picker. Additional HR users are then
created from **Admin → Companies** (each is scoped to its company).

You can also run the seeding manually at any time with **`pnpm db:seed`** (it's
idempotent). Or do it by hand: add the user under **Authentication → Users** and
run `update public.profiles set role='super_admin' where email='you@company.com';`

## 7. Run it

```bash
pnpm dev
```

Open <http://localhost:3000>, sign in as your super admin. You'll land in the
Admin Studio, where you can create companies, invite HR users, and build
conversion templates.

## 8. Deploy to Vercel

1. Push this repo to GitHub.
2. On <https://vercel.com>, **Import Project** → select the repo. Vercel
   auto-detects Next.js + pnpm. No `vercel.json` needed — the `build` script runs
   `prisma generate && next build`, and `prisma/schema.prisma` targets the Vercel
   runtime (`rhel-openssl-3.0.x`).
3. Add these **Environment Variables** (Project → Settings → Environment Variables):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   SUPABASE_SECRET_KEY=sb_secret_...
   # Prisma data layer — the transaction pooler (6543) with pgbouncer:
   DATABASE_URL=postgresql://postgres.<ref>:<db-password>@aws-1-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require&connection_limit=1
   SEED_ADMIN_EMAIL=you@company.com
   SEED_ADMIN_PASSWORD=<strong-password>
   SEED_ADMIN_NAME=Administrator
   NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
   NEXT_PUBLIC_DEMO_MODE=false
   ```

   > `DATABASE_URL` is what Prisma uses at runtime. (Alternatively, set
   > `SUPABASE_PROJECT_REF` + `SUPABASE_DB_PASSWORD` + `SUPABASE_REGION` and the
   > app assembles the URL itself — see `src/lib/db.ts`.) The `db:apply` /
   > `db:check` / `db:reset` scripts are dev-only and not needed on Vercel.

4. Deploy.
5. Back in Supabase **Authentication → URL Configuration**, add your Vercel URL
   to the allowed **Site URL** / redirect URLs.

## Useful scripts

| Command           | What it does                                          |
| ----------------- | ----------------------------------------------------- |
| `pnpm dev`        | Local dev server                                      |
| `pnpm build`      | Production build                                      |
| `pnpm test`       | Engine unit tests (Vitest)                            |
| `pnpm typecheck`  | TypeScript check                                      |
| `pnpm lint`       | ESLint                                                |
| `pnpm e2e`        | Playwright end-to-end tests                           |
| `pnpm db:apply`   | Apply `supabase/schema.sql` + reload PostgREST cache  |
| `pnpm db:check`   | PostgREST/role diagnostics via the pooler             |
| `pnpm db:reload`  | Signal PostgREST to reload its schema cache (PGRST002) |
| `pnpm db:seed`    | Create/repair the super-admin from `SEED_ADMIN_*` env |
| `pnpm db:reset`   | Guarded database reset (asks for consent — see below) |

All `pnpm db:*` scripts read `.env.local` (via `node --env-file`). `db:seed` uses
the secret key. `db:apply`, `db:check` and `db:reload` use the direct DB
connection (`SUPABASE_PROJECT_REF` / `SUPABASE_DB_PASSWORD` / `SUPABASE_REGION`,
port from `SUPABASE_DB_PORT`). `db:reset` uses **both** — the direct connection
to clear table data, and the secret key (Supabase Auth) to delete user accounts.
Run them from a machine that has those set.

### `pnpm db:reset` — guarded reset

Destructive. It asks for consent **twice, in order**, and each step is
independent (confirm one, skip the other). It requires you to type `yes`;
anything else skips that step. **The super-admin account is never deleted.**

1. **Remove ALL data from all tables?** — clears `companies`, `templates`,
   `template_versions`, and `conversions`.
2. **Remove ALL user accounts except the super-admin?** — deletes every
   non-super-admin user (Auth account + profile).
