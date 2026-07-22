import { NextResponse } from "next/server";

/**
 * Deprecated. Demo sign-in is now email-based (the role is decided by checking
 * the email against the seeded admin), matching the real login. This endpoint
 * just returns to the login screen.
 */
export function GET(request: Request) {
  return NextResponse.redirect(new URL("/login", request.url));
}
