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
