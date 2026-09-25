import { NextRequest, NextResponse } from "next/server";
import { clearAuthCookies, decodeAccessToken, ROLE_HOME } from "@/lib/auth";

const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get("access_token")?.value;
  const payload = accessToken ? decodeAccessToken(accessToken) : null;

  if (PUBLIC_PATHS.includes(pathname)) {
    if (payload) {
      return NextResponse.redirect(new URL(ROLE_HOME[payload.role], request.url));
    }
    // A present-but-expired/invalid token would otherwise be sent back to the
    // browser on every request, so clear it here instead of just ignoring it.
    return accessToken ? clearAuthCookies(NextResponse.next()) : NextResponse.next();
  }

  if (!accessToken || !payload) {
    const loginUrl = new URL("/login", request.url);
    return clearAuthCookies(NextResponse.redirect(loginUrl));
  }

  if (pathname.startsWith("/admin") && payload.role !== "ADMIN") {
    return NextResponse.redirect(new URL(ROLE_HOME[payload.role], request.url));
  }

  if (pathname.startsWith("/cashier") && payload.role !== "CASHIER") {
    return NextResponse.redirect(new URL(ROLE_HOME[payload.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
