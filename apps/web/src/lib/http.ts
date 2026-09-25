export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

// A 401 from one of these means "wrong credentials" / "session already gone"
// — not "session expired mid-use" — so they must not trigger the redirect.
const EXEMPT_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

let installed = false;
let handlingUnauthorized = false;
/** Shared by every concurrent 401 so only one refresh request is ever in flight at a time. */
let refreshPromise: Promise<boolean> | null = null;

function isExempt(url: string): boolean {
  return EXEMPT_PATHS.some((path) => url.includes(path));
}

function resolveUrl(input: RequestInfo | URL): string {
  return typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
}

/** Refreshes the session, deduplicating concurrent callers behind a single in-flight request. */
function refreshSession(baseFetch: typeof fetch): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = baseFetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function handleUnauthorized() {
  if (handlingUnauthorized) return;
  handlingUnauthorized = true;
  // A full navigation (not fetch) to a route that clears both auth cookies
  // server-side before landing on /login — httpOnly cookies can't be cleared
  // from client JS, and going straight to /login would let the middleware
  // see the still-valid-looking cookie and bounce back to /admin or
  // /cashier instead of actually logging out.
  window.location.href = "/auth/session-expired";
}

/**
 * Patches the global `fetch` once so that any client-side request to our API
 * coming back 401 first tries a silent refresh — retrying the original
 * request once on success — and only falls back to a hard logout redirect
 * if the refresh itself fails. There is no single shared client-fetch helper
 * in this app — every `lib/*.ts` and several components call `fetch`
 * directly — so this is the one place that can catch all of them (current
 * and future) without editing every call site. Install once from
 * <Providers>, which wraps the whole app.
 */
export function installUnauthorizedRedirect() {
  if (typeof window === "undefined" || installed) return;
  installed = true;

  const baseFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await baseFetch(input, init);
    const url = resolveUrl(input);

    if (
      res.status === 401 &&
      url.startsWith(API_URL) &&
      !isExempt(url) &&
      window.location.pathname !== "/login"
    ) {
      const refreshed = await refreshSession(baseFetch);
      if (refreshed) {
        // Bypasses this same interceptor on purpose — a second 401 after an
        // already-successful refresh means something else is wrong with the
        // request, not the session, so it's returned as-is rather than
        // refreshing again.
        return baseFetch(input, init);
      }
      handleUnauthorized();
    }

    return res;
  }) as typeof window.fetch;
}
