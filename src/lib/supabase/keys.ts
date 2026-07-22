/**
 * Supabase key resolution — supports both the new API key format
 * (publishable / secret) and the legacy format (anon / service_role).
 *
 * The NEXT_PUBLIC_* references are written statically so Next inlines them into
 * the client bundle; the `??` chain picks whichever is present at runtime.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

/** Public (browser-safe) key: new "publishable" key, or legacy "anon" key. */
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export const hasSupabasePublicConfig = Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);

/** Server-only secret key: new "secret" key, or legacy "service_role" key. */
export function getSupabaseSecretKey(): string | undefined {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? undefined;
}
