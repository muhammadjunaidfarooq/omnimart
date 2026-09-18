import type { Sale, PaymentMethod } from "./sales";
import type { ServiceTransaction } from "./services";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface DashboardKpis {
  /** Gross, before refunds — see AccountingService.getPnl's sales.total. */
  salesTotal: number;
  /** Total refunded over the range — see AccountingService.getPnl's refunds.total. */
  refundsTotal: number;
  /** salesTotal - refundsTotal — see AccountingService.getPnl's netRevenue. */
  netSales: number;
  /** Only the fee portion of service transactions — the underlying bill amount passes through and isn't store revenue. */
  serviceRevenue: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  /** Cash sales net of refunds, cash withdrawals, and shop expenses — see AccountingService.getDailyCashSummary. */
  cashInHand: number;
  /** A running prediction: cashInHand minus whatever inventory spend has been recorded (via Close Day) for the range so far — the actual physical cash remaining after every cash inflow/outflow. See DashboardService.getKpis. */
  netCashInHand: number;
  onlineTransferTotal: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}

/** Shared by every dashboard widget's fetch — omit from/to to keep that widget's own default window (today / last 30 days / last 12 months). */
export interface DashboardFilters {
  from?: string;
  to?: string;
  paymentMethod?: PaymentMethod;
  cashierId?: string;
}

function buildDashboardQuery(filters: DashboardFilters) {
  const query = new URLSearchParams();
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.paymentMethod) query.set("paymentMethod", filters.paymentMethod);
  if (filters.cashierId) query.set("cashierId", filters.cashierId);
  return query;
}

export const dashboardKeys = {
  kpis: (filters: DashboardFilters) => ["dashboard", "kpis", filters] as const,
  recentSales: (filters: DashboardFilters) => ["dashboard", "recent-sales", filters] as const,
  recentServiceTransactions: (filters: DashboardFilters) =>
    ["dashboard", "recent-service-transactions", filters] as const,
};

export async function fetchKpis(filters: DashboardFilters = {}): Promise<DashboardKpis> {
  const res = await fetch(`${API_URL}/dashboard/kpis?${buildDashboardQuery(filters)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch dashboard KPIs");
  return res.json();
}

export async function fetchRecentSales(filters: DashboardFilters = {}): Promise<Sale[]> {
  const res = await fetch(`${API_URL}/dashboard/recent-sales?${buildDashboardQuery(filters)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch recent sales");
  return res.json();
}

/** Powers the "Recent Sales" widget's Services view — see its Sales/Services toggle. */
export async function fetchRecentServiceTransactions(
  filters: DashboardFilters = {},
): Promise<ServiceTransaction[]> {
  const res = await fetch(
    `${API_URL}/dashboard/recent-service-transactions?${buildDashboardQuery(filters)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("Failed to fetch recent service transactions");
  return res.json();
}
