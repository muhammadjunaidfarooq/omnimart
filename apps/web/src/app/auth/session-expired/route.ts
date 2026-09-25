import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies } from "@/lib/auth";

/**
 * A session the server has already rejected (the referenced user no longer
 * exists, or a token refresh failed) can't redirect straight to /login —
 * the middleware would see the still-valid-looking cookie there and bounce
 * back to /admin or /cashier instead of actually logging out. Clearing both
 * cookies here first breaks that loop. Reached via a full navigation (not
 * fetch) from AppLayout's stale-session redirect and from the client-side
 * unauthorized handler in lib/http.ts.
 */
export function GET(request: NextRequest) {
  return clearAuthCookies(
    NextResponse.redirect(new URL("/login", request.url)),
  );
}
