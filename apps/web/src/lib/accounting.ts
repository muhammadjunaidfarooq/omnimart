import type { ExpenseCategory } from "./expenses";
import type { PaymentMethod } from "./sales";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface PnlReport {
  from: string | null;
  to: string | null;
  /** Only the fee portion of service transactions — the underlying bill amount passes through and isn't store revenue. */
  services: { total: number };
  sales: { cash: number; transfer: number; credit: number; total: number };
  refunds: { cash: number; transfer: number; credit: number; total: number };
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  expenses: { total: number; byCategory: { category: ExpenseCategory; total: number }[] };
  netProfit: number;
}

export interface DailyCashSummary {
  date: string;
  /** Cash collected — includes Cash Deposit intake (see cashDeposits), so subtract that for a pure product/bill-payment sales figure */
  cashSales: number;
  cashRefunds: number;
  /** Cents handed out via Cash Withdrawal transactions */
  cashWithdrawals: number;
  /** Cents received via Cash Deposit transactions — already included within cashSales above, not an additional term */
  cashDeposits: number;
  transferSales: number;
  transferRefunds: number;
  expenses: number;
  /** cashSales - cashRefunds - cashWithdrawals, before expenses */
  netCashBeforeExpenses: number;
  netCash: number;
  netTransfer: number;
}

export interface MonthlyPnlRow {
  month: string;
  revenue: number;
  refunds: number;
  netRevenue: number;
  cogs: number;
  /** Only the fee portion of service transactions in this month */
  serviceRevenue: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
}

export interface CashVsTransferRow {
  date: string;
  cashSales: number;
  transferSales: number;
  cashRefunds: number;
  transferRefunds: number;
  netCash: number;
  netTransfer: number;
}

export const accountingKeys = {
  pnl: (params: { from?: string; to?: string }) => ["accounting", "pnl", params] as const,
  dailyCashSummary: (date?: string) => ["accounting", "daily-cash-summary", date] as const,
  monthlyPnl: (params: MonthlyPnlParams) => ["accounting", "monthly-pnl", params] as const,
  cashVsTransfer: (params: { from?: string; to?: string }) =>
    ["accounting", "cash-vs-transfer", params] as const,
};

export async function fetchPnl(params: { from?: string; to?: string }): Promise<PnlReport> {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);

  const res = await fetch(`${API_URL}/accounting/pnl?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch P&L report");
  return res.json();
}

export async function fetchDailyCashSummary(date?: string): Promise<DailyCashSummary> {
  const query = new URLSearchParams();
  if (date) query.set("date", date);

  const res = await fetch(`${API_URL}/accounting/daily-cash-summary?${query}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch daily cash summary");
  return res.json();
}

export interface MonthlyPnlParams {
  from?: string;
  to?: string;
  paymentMethod?: PaymentMethod;
  cashierId?: string;
}

export async function fetchMonthlyPnl(params: MonthlyPnlParams): Promise<MonthlyPnlRow[]> {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.paymentMethod) query.set("paymentMethod", params.paymentMethod);
  if (params.cashierId) query.set("cashierId", params.cashierId);

  const res = await fetch(`${API_URL}/accounting/monthly-pnl?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch monthly P&L trend");
  return res.json();
}

export async function fetchCashVsTransferDaily(params: {
  from?: string;
  to?: string;
}): Promise<CashVsTransferRow[]> {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);

  const res = await fetch(`${API_URL}/accounting/cash-vs-transfer?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch cash vs transfer report");
  return res.json();
}
