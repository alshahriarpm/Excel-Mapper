import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { SUPABASE_URL, SUPABASE_PUBLIC_KEY, hasSupabasePublicConfig } from "@/lib/supabase/keys";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = ["/login", "/auth", "/_next", "/favicon", "/api/health"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p));
}

/**
 * Refresh the auth session on every request and gate protected routes.
 * Unauthenticated users are redirected to /login; signed-in users hitting
 * /login are sent to the home dispatcher.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  // Demo mode: no Supabase, but still gate on a lightweight role cookie so the
  // flow mirrors real login (unauthenticated → /login; role decides the rest).
  // Never honored in production (auth bypass must never ship live).
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true" && process.env.NODE_ENV !== "production") {
    const hasRole = Boolean(request.cookies.get("demo_role")?.value);
    if (!hasRole && !isPublic(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    if (hasRole && pathname === "/login") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Env not configured yet — don't hard-fail the whole app.
  if (!hasSupabasePublicConfig) {
    return response;
  }

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return response;
}
