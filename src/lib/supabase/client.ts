"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";
import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from "@/lib/supabase/keys";

/** Browser-side Supabase client (uses the public/publishable key + RLS). */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_PUBLIC_KEY);
}
