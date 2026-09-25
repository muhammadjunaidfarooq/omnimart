import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_URL = "http://localhost:3001";

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status });
}

function mockLocation(pathname: string) {
  const location = { pathname, href: `http://localhost:3000${pathname}` };
  vi.stubGlobal("location", location);
  return location;
}

describe("installUnauthorizedRedirect", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    mockLocation("/admin");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries the original request once after a successful silent refresh", async () => {
    const calls: string[] = [];
    const originalFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("/auth/refresh")) return jsonResponse(200);
      const priorCalls = calls.filter((c) => c.includes("/protected")).length;
      return priorCalls === 1 ? jsonResponse(401) : jsonResponse(200, { data: "ok" });
    });
    window.fetch = originalFetch as unknown as typeof fetch;

    const { installUnauthorizedRedirect } = await import("./http");
    installUnauthorizedRedirect();

    const res = await window.fetch(`${API_URL}/protected`);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: "ok" });
    expect(originalFetch).toHaveBeenCalledTimes(3);
    expect(calls).toEqual([
      `${API_URL}/protected`,
      `${API_URL}/auth/refresh`,
      `${API_URL}/protected`,
    ]);
  });

  it("queues concurrent 401s behind a single in-flight refresh call", async () => {
    let refreshCalls = 0;
    const protectedCallCounts: Record<string, number> = {};
    const originalFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/refresh")) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return jsonResponse(200);
      }
      protectedCallCounts[url] = (protectedCallCounts[url] ?? 0) + 1;
      return protectedCallCounts[url] === 1 ? jsonResponse(401) : jsonResponse(200);
    });
    window.fetch = originalFetch as unknown as typeof fetch;

    const { installUnauthorizedRedirect } = await import("./http");
    installUnauthorizedRedirect();

    const [resA, resB] = await Promise.all([
      window.fetch(`${API_URL}/protected-a`),
      window.fetch(`${API_URL}/protected-b`),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    expect(refreshCalls).toBe(1);
  });

  it("redirects to /auth/session-expired and returns the original 401 when refresh fails", async () => {
    const originalFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/auth/refresh")) return jsonResponse(401);
      return jsonResponse(401);
    });
    window.fetch = originalFetch as unknown as typeof fetch;

    const { installUnauthorizedRedirect } = await import("./http");
    installUnauthorizedRedirect();
    const location = mockLocation("/admin");

    const res = await window.fetch(`${API_URL}/protected`);

    expect(res.status).toBe(401);
    expect(location.href).toBe("/auth/session-expired");
  });

  it("does not attempt a refresh for exempt auth paths", async () => {
    const originalFetch = vi.fn(async () => jsonResponse(401));
    window.fetch = originalFetch as unknown as typeof fetch;

    const { installUnauthorizedRedirect } = await import("./http");
    installUnauthorizedRedirect();

    const res = await window.fetch(`${API_URL}/auth/login`, { method: "POST" });

    expect(res.status).toBe(401);
    expect(originalFetch).toHaveBeenCalledTimes(1);
  });

  it("does not trigger the refresh flow when already on /login", async () => {
    mockLocation("/login");
    const originalFetch = vi.fn(async () => jsonResponse(401));
    window.fetch = originalFetch as unknown as typeof fetch;

    const { installUnauthorizedRedirect } = await import("./http");
    installUnauthorizedRedirect();

    const res = await window.fetch(`${API_URL}/some-endpoint`);

    expect(res.status).toBe(401);
    expect(originalFetch).toHaveBeenCalledTimes(1);
  });
});
