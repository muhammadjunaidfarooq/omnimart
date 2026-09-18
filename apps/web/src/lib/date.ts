/**
 * Date/time formatting pinned to a fixed locale — `toLocaleDateString()`/
 * `toLocaleString()` with no locale argument use the runtime's default
 * locale, which differs between the Node server (SSR) and the browser and
 * causes a React hydration mismatch on any page that renders a date in its
 * server-rendered initial content.
 */
const LOCALE = "en-US";

export function formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(LOCALE, options);
}

export function formatDateTime(value: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString(LOCALE, options);
}
