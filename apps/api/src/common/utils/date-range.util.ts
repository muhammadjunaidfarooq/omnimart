/** Exclusive upper bound for a "to" date filter, so the whole day is included regardless of time zone. */
export function endOfDayExclusive(dateStr: string): Date {
  const date = new Date(dateStr);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

/** [from, to) for the current calendar month in UTC — the default reporting window when none is given. */
export function currentMonthRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { from, to };
}

/** Resolves optional "from"/"to" date-string query params into exclusive-upper-bound Dates for Prisma. */
export function resolveDateRange(
  from?: string,
  to?: string,
): { from?: Date; to?: Date } {
  return {
    from: from ? new Date(from) : undefined,
    to: to ? endOfDayExclusive(to) : undefined,
  };
}

/** [from, to) covering the last `days` days up to and including today — the default chart window. */
export function lastNDaysRange(days: number): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - days);
  return { from, to };
}

/** [from, to) covering the last `months` calendar months, including the current one. */
export function lastNMonthsRange(months: number): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1),
  );
  return { from, to };
}

/** Every calendar day in [from, to) as "YYYY-MM-DD", so chart/report rows include zero-activity days. */
export function enumerateDays(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
  );
  while (cursor < to) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/** Every calendar month in [from, to) as "YYYY-MM", so chart/report rows include zero-activity months. */
export function enumerateMonths(from: Date, to: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1),
  );
  while (cursor < to) {
    months.push(cursor.toISOString().slice(0, 7));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}
