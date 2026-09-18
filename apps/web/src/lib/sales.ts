import type { PaginatedResponse } from "./api";
import type { DiscountType } from "./catalog";
import type { SortOrder } from "./use-sort";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type SaleStatus = "DRAFT" | "COMPLETED";
export type PaymentMethod = "CASH" | "TRANSFER" | "CREDIT" | "SPLIT";
export type PaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  TRANSFER: "Transfer",
  CREDIT: "Khata (Credit)",
  SPLIT: "Cash + Khata",
};

export function paymentMethodLabel(method: PaymentMethod | null): string {
  return method ? PAYMENT_METHOD_LABELS[method] : "—";
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRateBps: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
  /** Only present on the sale detail response (GET /sales/:id) */
  refundedQuantity?: number;
  refundableQuantity?: number;
}

export interface RefundItem {
  id: string;
  refundId: string;
  saleItemId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
}

export interface Refund {
  id: string;
  saleId: string;
  refundedById: string;
  refundedBy: { id: string; name: string };
  reason: string | null;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  createdAt: string;
  items: RefundItem[];
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  status: SaleStatus;
  cashierId: string;
  cashier: { id: string; name: string };
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
  paymentMethod: PaymentMethod | null;
  cashTendered: number | null;
  changeDue: number | null;
  transferReference: string | null;
  paymentStatus: PaymentStatus;
  amountPaid: number;
  borrowerId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: SaleItem[];
  /** Only present on the sale detail response (GET /sales/:id) */
  refunds?: Refund[];
  /** Present on the sale detail response and the history list */
  refundedAmount?: number;
}

export interface SalesHistoryParams {
  page: number;
  pageSize: number;
  from?: string;
  to?: string;
  productId?: string;
  invoiceNumber?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}

export interface RefundItemInput {
  saleItemId: string;
  quantity: number;
}

export interface CartLineInput {
  productId: string;
  quantity: number;
  discountType?: DiscountType;
  discountValue?: number;
  /** Cashier override for this line's unit price, in cents — this transaction only, never saved to the product. */
  unitPriceOverride?: number;
  /** Cashier override for this line's fixed total price, in cents — e.g. a bundle deal like "3 for 50". Mutually exclusive with unitPriceOverride. */
  lineTotalOverride?: number;
}

export interface CheckoutInput {
  paymentMethod: PaymentMethod;
  cashTendered?: number;
  transferReference?: string;
  /** Cents paid in cash up front for a SPLIT sale — the remainder is billed to the borrower as khata */
  cashAmount?: number;
  borrowerId?: string;
  newBorrowerName?: string;
  newBorrowerPhone?: string;
  /** Whether to auto-apply the borrower's existing store credit toward this sale. Defaults to true. */
  useCredit?: boolean;
  /** For a CASH sale with change due: credit the change to borrowerId/newBorrowerName instead of handing it back. */
  creditChangeToBorrower?: boolean;
}

export interface SalesReportParams {
  from?: string;
  to?: string;
  limit?: number;
  paymentMethod?: PaymentMethod;
  cashierId?: string;
}

export interface TopProduct {
  productId: string;
  name: string;
  sku: string;
  quantitySold: number;
  revenue: number;
}

export interface DailySalesRow {
  date: string;
  count: number;
  cash: number;
  transfer: number;
  credit: number;
  total: number;
}

export interface MonthlySalesRow {
  month: string;
  count: number;
  cash: number;
  transfer: number;
  credit: number;
  total: number;
}

export const salesKeys = {
  all: ["sales"] as const,
  drafts: () => ["sales", "drafts"] as const,
  detail: (id: string) => ["sales", "detail", id] as const,
  history: (params: SalesHistoryParams) => ["sales", "history", params] as const,
  topProducts: (params: SalesReportParams) => ["sales", "top-products", params] as const,
  daily: (params: SalesReportParams) => ["sales", "daily", params] as const,
  monthly: (params: SalesReportParams) => ["sales", "monthly", params] as const,
};

async function parseErrorMessage(res: Response, fallback: string) {
  const err = await res.json().catch(() => ({}));
  const message = (err as { message?: string | string[] }).message;
  return Array.isArray(message) ? message.join(", ") : message ?? fallback;
}

export async function fetchDrafts(): Promise<Sale[]> {
  const res = await fetch(`${API_URL}/sales/drafts`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch held bills");
  return res.json();
}

export async function fetchSale(id: string): Promise<Sale> {
  const res = await fetch(`${API_URL}/sales/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch sale");
  return res.json();
}

export async function saveDraft(items: CartLineInput[], draftId?: string): Promise<Sale> {
  const res = await fetch(`${API_URL}/sales/draft${draftId ? `/${draftId}` : ""}`, {
    method: draftId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not hold bill"));
  return res.json();
}

export async function deleteDraft(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/sales/draft/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not delete held bill"));
}

export async function checkout(
  items: CartLineInput[],
  payment: CheckoutInput,
  draftId?: string,
): Promise<Sale> {
  const res = await fetch(`${API_URL}/sales${draftId ? `/${draftId}` : ""}/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ items, ...payment }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Checkout failed"));
  return res.json();
}

export async function fetchSalesHistory(params: SalesHistoryParams): Promise<PaginatedResponse<Sale>> {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.productId) query.set("productId", params.productId);
  if (params.invoiceNumber) query.set("invoiceNumber", params.invoiceNumber);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);

  const res = await fetch(`${API_URL}/sales?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch sales history");
  return res.json();
}

function buildReportQuery(params: SalesReportParams) {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.paymentMethod) query.set("paymentMethod", params.paymentMethod);
  if (params.cashierId) query.set("cashierId", params.cashierId);
  return query;
}

export async function fetchTopProducts(params: SalesReportParams = {}): Promise<TopProduct[]> {
  const res = await fetch(`${API_URL}/sales/reports/top-products?${buildReportQuery(params)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch top products");
  return res.json();
}

export async function fetchDailySales(params: SalesReportParams = {}): Promise<DailySalesRow[]> {
  const res = await fetch(`${API_URL}/sales/reports/daily?${buildReportQuery(params)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch daily sales");
  return res.json();
}

export async function fetchMonthlySales(params: SalesReportParams = {}): Promise<MonthlySalesRow[]> {
  const res = await fetch(`${API_URL}/sales/reports/monthly?${buildReportQuery(params)}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch monthly sales");
  return res.json();
}

export async function createRefund(
  saleId: string,
  items: RefundItemInput[],
  reason?: string,
): Promise<Refund> {
  const res = await fetch(`${API_URL}/sales/${saleId}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ items, reason: reason || undefined }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Refund failed"));
  return res.json();
}
