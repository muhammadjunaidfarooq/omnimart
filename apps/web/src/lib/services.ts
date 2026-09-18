import type { PaginatedResponse } from "./api";
import type { SortOrder } from "./use-sort";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * BILL_PAYMENT: the customer pays the shop (CASH/TRANSFER); serviceFee is
 * store revenue, billAmount passes through. CASH_WITHDRAWAL: the shop hands
 * the customer physical cash, funded by a bank transfer they already made —
 * a cash outflow. CASH_DEPOSIT: the customer hands the shop physical cash,
 * and the shop transfers the same amount out on their behalf — a cash
 * inflow with no fee. Neither CASH_WITHDRAWAL nor CASH_DEPOSIT supports a fee.
 */
export type ServiceDirection = "BILL_PAYMENT" | "CASH_WITHDRAWAL" | "CASH_DEPOSIT";

export const SERVICE_DIRECTION_LABELS: Record<ServiceDirection, string> = {
  BILL_PAYMENT: "Bill Payment",
  CASH_WITHDRAWAL: "Cash Withdrawal",
  CASH_DEPOSIT: "Cash Deposit",
};

export interface Service {
  id: string;
  name: string;
  direction: ServiceDirection;
  /** Cents — prefills the cashier's service fee field; null means no default fee. Ignored when useTieredFee is true, or when direction isn't BILL_PAYMENT. */
  defaultFee: number | null;
  /** When true, the fee is computed from the bill amount instead of defaultFee — see feePerThousand */
  useTieredFee: boolean;
  /** Cents charged per Rs 1,000 of the bill amount, rounded up — see computeTieredFee */
  feePerThousand: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceInput {
  name: string;
  direction?: ServiceDirection;
  /** Cents */
  defaultFee?: number;
  useTieredFee?: boolean;
  /** Cents */
  feePerThousand?: number;
  isActive?: boolean;
}

/** Cents per Rs 1,000 — the slab size for a tiered-fee service's charge. */
const THOUSAND_CENTS = 100_000;

/**
 * Mirrors the server's ServiceTransactionsService.computeTieredFee — used to
 * show the cashier a live preview before submitting; the server always
 * recalculates authoritatively.
 */
export function computeTieredFee(billAmountCents: number, feePerThousandCents: number): number {
  if (billAmountCents <= 0) return 0;
  const slabs = Math.ceil(billAmountCents / THOUSAND_CENTS);
  return slabs * feePerThousandCents;
}

/** No khata/credit path for services — CASH or TRANSFER only. */
export type ServicePaymentMethod = "CASH" | "TRANSFER";

export interface ServiceTransaction {
  id: string;
  transactionNumber: string;
  serviceId: string;
  service: { id: string; name: string };
  cashierId: string;
  cashier: { id: string; name: string };
  /** Snapshot of Service.direction at the time this transaction was recorded — see the Prisma schema doc comment. */
  direction: ServiceDirection;
  referenceNumber: string | null;
  /** For a BILL_PAYMENT service: the bill amount. For CASH_WITHDRAWAL/CASH_DEPOSIT: whichever side of the transaction feeInclusive fixed — see that field. */
  billAmount: number;
  serviceFee: number;
  /**
   * CASH_WITHDRAWAL/CASH_DEPOSIT only. Every such transaction has a
   * money-in side (a transfer for a withdrawal, cash for a deposit) and a
   * money-out side (cash for a withdrawal, a transfer for a deposit), with
   * fee = amountIn - amountOut:
   *   - true: billAmount IS amountIn; the fee comes out of it (e.g. a
   *     withdrawal funded by a 1,000 transfer pays out 980 cash with a 20 fee).
   *   - false (default): billAmount IS amountOut; the fee is added on top
   *     to find amountIn (e.g. a withdrawal paying out 1,000 cash needs a
   *     1,020 transfer to fund it).
   * Always false (irrelevant) for BILL_PAYMENT.
   */
  feeInclusive: boolean;
  totalAmount: number;
  paymentMethod: ServicePaymentMethod;
  transferReference: string | null;
  amountReceived: number;
  changeDue: number;
  note: string | null;
  createdAt: string;
}

export interface CreateServiceTransactionInput {
  serviceId: string;
  referenceNumber?: string;
  /** For BILL_PAYMENT: the bill amount, in cents. For CASH_WITHDRAWAL/CASH_DEPOSIT: whichever side of the transaction feeInclusive fixes — see that field. */
  billAmount: number;
  /** Cents — for every direction */
  serviceFee?: number;
  /** BILL_PAYMENT only */
  paymentMethod?: ServicePaymentMethod;
  /** Cents — required for a BILL_PAYMENT/CASH transaction, ignored otherwise */
  amountReceived?: number;
  /** Required for a BILL_PAYMENT/TRANSFER transaction, and always for CASH_WITHDRAWAL/CASH_DEPOSIT */
  transferReference?: string;
  /**
   * CASH_WITHDRAWAL/CASH_DEPOSIT only — true: billAmount is the money-in
   * side (a transfer for a withdrawal, cash for a deposit) and the fee
   * comes out of it (e.g. 980 cash out for a 1,000 transfer in with a 20
   * fee). false (default): billAmount is the money-out side (cash for a
   * withdrawal, a transfer for a deposit) and the fee is added on top to
   * find the money-in side (e.g. a 1,000 cash payout needs a 1,020
   * transfer in). Ignored for BILL_PAYMENT.
   */
  feeInclusive?: boolean;
  /** Free-text note — e.g. a withdrawal/deposit customer's name or phone number */
  note?: string;
}

export interface ServiceTransactionQueryParams {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  serviceId?: string;
  cashierId?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export const servicesKeys = {
  all: ["services"] as const,
  list: () => ["services", "list"] as const,
  active: () => ["services", "active"] as const,
};

export const serviceTransactionsKeys = {
  all: ["service-transactions"] as const,
  list: (params: ServiceTransactionQueryParams) => ["service-transactions", "list", params] as const,
};

async function parseErrorMessage(res: Response, fallback: string) {
  const err = await res.json().catch(() => ({}));
  const message = (err as { message?: string | string[] }).message;
  return Array.isArray(message) ? message.join(", ") : message ?? fallback;
}

function buildQuery<T extends object>(params: T) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  return query;
}

export async function fetchServices(): Promise<Service[]> {
  const res = await fetch(`${API_URL}/services`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch services");
  return res.json();
}

/** Active services only — powers the cashier POS's service picker. */
export async function fetchActiveServices(): Promise<Service[]> {
  const res = await fetch(`${API_URL}/services/active`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch services");
  return res.json();
}

export async function createService(input: ServiceInput): Promise<Service> {
  const res = await fetch(`${API_URL}/services`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not create service"));
  return res.json();
}

export async function updateService(id: string, input: Partial<ServiceInput>): Promise<Service> {
  const res = await fetch(`${API_URL}/services/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not update service"));
  return res.json();
}

export async function updateServiceStatus(id: string, isActive: boolean): Promise<Service> {
  const res = await fetch(`${API_URL}/services/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ isActive }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not update service status"));
  return res.json();
}

export async function deleteService(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/services/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not delete service"));
}

export async function fetchServiceTransactions(
  params: ServiceTransactionQueryParams,
): Promise<PaginatedResponse<ServiceTransaction>> {
  const query = buildQuery(params);
  const res = await fetch(`${API_URL}/service-transactions?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch service transactions");
  return res.json();
}

/**
 * Every transaction matching the current filters, not just one page — for
 * CSV export, which must cover everything the filters select rather than
 * silently truncating at some page size (see fetchAllInventory).
 */
export async function fetchAllServiceTransactions(
  params: Omit<ServiceTransactionQueryParams, "page" | "pageSize">,
): Promise<ServiceTransaction[]> {
  const first = await fetchServiceTransactions({ ...params, page: 1, pageSize: 1 });
  if (first.total <= 1) return first.items;

  const all = await fetchServiceTransactions({ ...params, page: 1, pageSize: first.total });
  return all.items;
}

export async function createServiceTransaction(
  input: CreateServiceTransactionInput,
): Promise<ServiceTransaction> {
  const res = await fetch(`${API_URL}/service-transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not record transaction"));
  return res.json();
}
