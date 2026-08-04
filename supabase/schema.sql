-- Combined schema for Bulk Mapper. Paste into the Supabase SQL Editor and run.
-- (Equivalent to running every file in supabase/migrations/ in order.)

-- ===== supabase/migrations/0001_init.sql =====
-- ===========================================================================
-- Bulk Mapper — initial schema, RLS and auth wiring
-- Two roles: super_admin (global, authors companies + templates + rules)
--            hr         (scoped to one company, runs conversions only)
-- ===========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        text not null default 'hr' check (role in ('super_admin', 'hr')),
  company_id  uuid references public.companies (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.templates (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  name                  text not null,
  description           text,
  status                text not null default 'draft' check (status in ('draft', 'active', 'inactive')),
  version               integer not null default 1,
  target_configuration  jsonb not null default '{}'::jsonb,
  source_configuration  jsonb not null default '{}'::jsonb,
  rules                 jsonb not null default '[]'::jsonb,
  default_rule          jsonb,
  unique_target_fields  jsonb not null default '[]'::jsonb,
  output_configuration  jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references auth.users (id) on delete set null
);
create index if not exists templates_company_idx on public.templates (company_id);

-- Immutable history of template versions (never overwritten).
create table if not exists public.template_versions (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.templates (id) on delete cascade,
  version      integer not null,
  snapshot     jsonb not null,
  created_at   timestamptz not null default now(),
  created_by   uuid references auth.users (id) on delete set null
);
create index if not exists template_versions_template_idx on public.template_versions (template_id);

-- Light audit log of conversions. Per the privacy decision, raw source rows
-- are NOT stored — only who ran what, when, and the result counts.
create table if not exists public.conversions (
  id                uuid primary key default gen_random_uuid(),
  template_id       uuid references public.templates (id) on delete set null,
  company_id        uuid not null references public.companies (id) on delete cascade,
  source_file_name  text,
  template_version  integer,
  total_rows        integer not null default 0,
  ready_rows        integer not null default 0,
  incomplete_rows   integer not null default 0,
  excluded_rows     integer not null default 0,
  summary           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  created_by        uuid references auth.users (id) on delete set null
);
create index if not exists conversions_company_idx on public.conversions (company_id);

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER to avoid recursive RLS on profiles)
-- ---------------------------------------------------------------------------

-- NOTE: deliberately NOT named "current_role" — that is a reserved SQL keyword,
-- and a reserved-word function living in the PostgREST-exposed "public" schema
-- can wedge PostgREST's schema-cache load. Use a plain, non-reserved name.
create or replace function public.profile_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.current_company()
returns uuid language sql stable security definer set search_path = public as $$
  select company_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

-- Keep templates.updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists templates_touch on public.templates;
create trigger templates_touch before update on public.templates
  for each row execute function public.touch_updated_at();

-- Auto-create a profile when a new auth user signs up (default role: hr).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role, company_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'hr'),
    (new.raw_user_meta_data->>'company_id')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.companies         enable row level security;
alter table public.profiles          enable row level security;
alter table public.templates         enable row level security;
alter table public.template_versions enable row level security;
alter table public.conversions       enable row level security;

-- Policies are dropped-then-created so this file is safe to re-run on an
-- already-provisioned database (Postgres has no CREATE POLICY IF NOT EXISTS).

-- companies -----------------------------------------------------------------
drop policy if exists companies_super_all on public.companies;
create policy companies_super_all on public.companies
  for all using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists companies_member_read on public.companies;
create policy companies_member_read on public.companies
  for select using (id = public.current_company());

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (id = auth.uid());
drop policy if exists profiles_super_all on public.profiles;
create policy profiles_super_all on public.profiles
  for all using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = public.profile_role()); -- can't self-promote

-- templates -----------------------------------------------------------------
drop policy if exists templates_super_all on public.templates;
create policy templates_super_all on public.templates
  for all using (public.is_super_admin()) with check (public.is_super_admin());
-- HR may only READ their own company's usable templates.
drop policy if exists templates_hr_read on public.templates;
create policy templates_hr_read on public.templates
  for select using (
    company_id = public.current_company() and status in ('active', 'inactive')
  );

-- template_versions ---------------------------------------------------------
drop policy if exists template_versions_super_all on public.template_versions;
create policy template_versions_super_all on public.template_versions
  for all using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists template_versions_hr_read on public.template_versions;
create policy template_versions_hr_read on public.template_versions
  for select using (
    template_id in (select id from public.templates where company_id = public.current_company())
  );

-- conversions ---------------------------------------------------------------
drop policy if exists conversions_super_all on public.conversions;
create policy conversions_super_all on public.conversions
  for all using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists conversions_company_read on public.conversions;
create policy conversions_company_read on public.conversions
  for select using (company_id = public.current_company());
drop policy if exists conversions_company_insert on public.conversions;
create policy conversions_company_insert on public.conversions
  for insert with check (company_id = public.current_company() and created_by = auth.uid());

-- ===== supabase/migrations/0002_user_blocking.sql =====
-- ===========================================================================
-- Add a "blocked" flag to profiles so admins can disable an account.
-- Enforcement is twofold: Supabase Auth ban (can't authenticate) + this flag
-- (checked on every request; mirrored for display in the admin UI).
-- ===========================================================================

alter table public.profiles
  add column if not exists blocked boolean not null default false;

-- ===== supabase/migrations/0003_company_blocking.sql =====
-- ===========================================================================
-- Add a "blocked" flag to companies. A blocked company's HR users are denied a
-- session (enforced in getSessionProfile); the super-admin is never affected.
-- ===========================================================================

alter table public.companies
  add column if not exists blocked boolean not null default false;


-- ===== supabase/migrations/0004_theme_preference.sql =====
-- ===========================================================================
-- Remember each user's colour scheme so it follows them between devices. The
-- rendered theme still comes from a cookie so the first paint is correct; this
-- column is the durable copy the cookie is seeded from.
-- ===========================================================================

alter table public.profiles
  add column if not exists theme text not null default 'system'
  check (theme in ('light', 'dark', 'system'));
