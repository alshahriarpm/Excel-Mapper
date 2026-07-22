-- ===========================================================================
-- Add a "blocked" flag to profiles so admins can disable an account.
-- Enforcement is twofold: Supabase Auth ban (can't authenticate) + this flag
-- (checked on every request; mirrored for display in the admin UI).
-- ===========================================================================

alter table public.profiles
  add column if not exists blocked boolean not null default false;
