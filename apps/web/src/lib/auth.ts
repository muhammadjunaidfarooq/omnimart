import type { NextResponse } from "next/server";

export type Role = "ADMIN" | "CASHIER";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const ROLE_HOME: Record<Role, string> = {
  ADMIN: "/admin",
  CASHIER: "/cashier",
};

export function decodeAccessToken(
  token: string,
): { sub: string; email: string; role: Role; exp: number } | null {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(decoded);

    if (typeof parsed.exp !== "number" || parsed.exp * 1000 <= Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Clears both auth cookies on a response — the only correct way to end a
 * session the server has rejected. Shared by the middleware's own redirect
 * and by the /auth/session-expired route so a stale-but-unexpired token
 * never survives to be seen again on the next request to /login.
 */
export function clearAuthCookies<T extends NextResponse>(response: T): T {
  response.cookies.delete("access_token");
  response.cookies.delete("refresh_token");
  return response;
}
