const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Parses a jsonwebtoken-style duration string (e.g. "15m", "1d", "7d" — the
 * same format used by JWT_ACCESS_EXPIRES_IN/JWT_REFRESH_EXPIRES_IN) into
 * milliseconds, for use as a cookie's maxAge so it persists for as long as
 * the token it carries stays valid, instead of only for the browser session.
 */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration string: "${value}"`);
  }
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}
