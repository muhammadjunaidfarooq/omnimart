export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// A 401 from one of these means "wrong credentials" / "session already gone"
// — not "session expired mid-use" — so they must not trigger the redirect.
const EXEMPT_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

let installed = false;
let handlingUnauthorized = false;

function isExempt(url: string): boolean {
  return EXEMPT_PATHS.some((path) => url.includes(path));
}

function handleUnauthorized() {
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  // No point calling POST /auth/logout here — it requires a valid access
  // token itself, which is exactly what just failed. A hard navigation to
  // /login is enough: it drops all client state, and logging back in
  // overwrites whatever's left of the stale session cookies regardless.
  window.location.href = "/login";
}

/**
 * Patches the global `fetch` once so that any client-side request to our API
 * coming back 401 (expired/invalid session) auto-logs-out and redirects to
 * /login, instead of the caller failing silently or with a confusing error.
 * There is no single shared client-fetch helper in this app — every
 * `lib/*.ts` and several components call `fetch` directly — so this is the
 * one place that can catch all of them (current and future) without editing
 * every call site. Install once from <Providers>, which wraps the whole app.
 */
export function installUnauthorizedRedirect() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  const baseFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await baseFetch(input, init);
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

    if (
      res.status === 401 &&
      url.startsWith(API_URL) &&
      !isExempt(url) &&
      window.location.pathname !== "/login"
    ) {
      handleUnauthorized();
    }

    return res;
  }) as typeof window.fetch;
}
