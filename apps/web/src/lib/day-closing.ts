import type { PaginatedResponse } from "./api";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface DayClosing {
  id: string;
  date: string;
  totalSales: number;
  /** Cash sales net of refunds and Cash Withdrawal payouts, plus Cash Deposit intake, before inventory/expense deductions */
  cashFromSales: number;
  cashWithdrawals: number;
  cashDeposits: number;
  expenses: number;
  cashUsedForInventory: number;
  /** cashFromSales - cashUsedForInventory */
  cashRemainingFromSales: number;
  /** cashRemainingFromSales - expenses — the actual physical cash left in the drawer */
  netCashInHand: number;
  note: string | null;
  closedById: string;
  closedBy: { id: string; name: string };
  closedAt: string;
}

export interface DayClosingPreview {
  date: string;
  totalSales: number;
  /** Raw components — see cashFromSales for the already-netted figure derived from these. */
  cashSales: number;
  cashRefunds: number;
  cashWithdrawals: number;
  cashDeposits: number;
  /** cashSales - cashRefunds - cashWithdrawals + cashDeposits, before inventory/expense deductions */
  cashFromSales: number;
  expenses: number;
  closing: DayClosing | null;
}

export interface DayClosingQueryParams {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
}

export interface CloseDayInput {
  date?: string;
  cashUsedForInventory: number;
  note?: string;
}

export const dayClosingKeys = {
  all: ["day-closing"] as const,
  list: (params: DayClosingQueryParams) => ["day-closing", "list", params] as const,
  preview: (date?: string) => ["day-closing", "preview", date] as const,
};

async function parseErrorMessage(res: Response, fallback: string) {
  const err = await res.json().catch(() => ({}));
  const message = (err as { message?: string | string[] }).message;
  return Array.isArray(message) ? message.join(", ") : message ?? fallback;
}

export async function fetchDayClosingPreview(date?: string): Promise<DayClosingPreview> {
  const query = new URLSearchParams();
  if (date) query.set("date", date);

  const res = await fetch(`${API_URL}/day-closing/preview?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Failed to load day closing preview"));
  return res.json();
}

export async function fetchDayClosings(params: DayClosingQueryParams): Promise<PaginatedResponse<DayClosing>> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }

  const res = await fetch(`${API_URL}/day-closing?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Failed to fetch day closings"));
  return res.json();
}

export async function closeDay(input: CloseDayInput): Promise<DayClosing> {
  const res = await fetch(`${API_URL}/day-closing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not close the day"));
  return res.json();
}
