import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createAdminBase } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";
import { SUPABASE_URL, SUPABASE_PUBLIC_KEY, getSupabaseSecretKey } from "@/lib/supabase/keys";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/** Server-side Supabase client bound to the request's cookies (RLS applies). */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore; middleware
            // refreshes the session cookie.
          }
        },
      },
    },
  );
}

/**
 * Service-role client for privileged admin actions ONLY (e.g. creating a
 * company's first HR user). Never expose to the browser; bypasses RLS.
 */
export function createAdminClient() {
  const key = getSupabaseSecretKey();
  if (!key) {
    throw new Error(
      "No Supabase secret key configured. Set SUPABASE_SECRET_KEY (new format) or " +
        "SUPABASE_SERVICE_ROLE_KEY (legacy) to use admin features.",
    );
  }
  return createAdminBase<Database>(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
