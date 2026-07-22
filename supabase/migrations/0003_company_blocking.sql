-- ===========================================================================
-- Add a "blocked" flag to companies. A blocked company's HR users are denied a
-- session (enforced in getSessionProfile); the super-admin is never affected.
-- ===========================================================================

alter table public.companies
  add column if not exists blocked boolean not null default false;
