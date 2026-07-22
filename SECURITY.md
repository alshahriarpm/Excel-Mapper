# Security model

## Authentication

- **Provider:** Supabase Auth. Passwords are **hashed (bcrypt) by Supabase** and
  never stored, logged, or seen by application code. This app never persists a
  plaintext password.
- **Transport:** all auth happens over HTTPS (enforced on Vercel).
- **Sessions:** managed by `@supabase/ssr` using **httpOnly, SameSite cookies**;
  the session is refreshed in middleware on every request. Client JavaScript
  cannot read the session cookie.
- **Login:** email + password only. The **role is derived from the account**
  (the user's `profiles.role`), never chosen at login. Failed logins return a
  generic error (no account-existence disclosure).
- **Route protection:** middleware redirects unauthenticated requests to
  `/login`; server components re-check the role; the database enforces access
  with **Row-Level Security**. Three independent layers.

## Passwords

- Enforced at account creation (server-side, source of truth — see
  `src/lib/password.ts`): **minimum 6 characters, no maximum, no composition
  rules**. The client mirrors this for instant feedback. (Supabase Auth can add
  its own minimum / leaked-password protection in the dashboard if you want more.)
- The **seeded admin** password comes from `SEED_ADMIN_PASSWORD` (env only,
  `.env.local` is git-ignored). Startup warns if it's weak. To change it after
  first seed, use Supabase's password reset — not the env var.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` is **server-only**: it has no `NEXT_PUBLIC_`
  prefix (so it is never inlined into the browser bundle), and the modules that
  use it (`src/lib/supabase/server.ts`, `src/lib/seed.ts`) import `server-only`,
  which makes the build **fail** if they are ever pulled into client code.
- Only the anon key reaches the browser; RLS is what protects the data behind it.

## Multi-tenant isolation

- RLS scopes every table by company and role: a `super_admin` is global; an `hr`
  user can only read their own company's active templates and can never reach
  admin data or another company's data — enforced in the database, not just the UI.

## Demo mode (development only)

- `NEXT_PUBLIC_DEMO_MODE=true` runs the app with no backend and **bypasses
  authentication** for local previews.
- This is **hard-disabled in production**: the flag is ignored whenever
  `NODE_ENV === "production"` (checked in the demo flag, the middleware, and the
  login page). An auth-bypass build can never ship live. To show a hosted demo,
  deploy with real Supabase auth (the admin is auto-seeded from env).

## Operational notes

- Never commit `.env.local`. Rotate the service-role key if it is ever exposed.
- Enable email confirmation / MFA in the Supabase dashboard for production.
- Consider Supabase Auth rate-limiting / CAPTCHA settings for public sign-in.
