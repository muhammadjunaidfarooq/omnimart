import type { PaginatedResponse } from "./api";
import type {
  ExpiryBatch,
  ExpiryStatusFilter,
  InventorySummary,
  Product,
  StockBatch,
  StockMovement,
  StockStatus,
} from "./catalog";
import type { SortOrder } from "./use-sort";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const inventoryKeys = {
  all: ["inventory"] as const,
  list: (params: {
    page: number;
    search: string;
    stockStatus: StockStatus;
    excludeHiddenCategories?: boolean;
    sortBy?: string;
    sortOrder?: SortOrder;
  }) => ["inventory", "list", params] as const,
  summary: () => ["inventory", "summary"] as const,
  movements: (productId: string) => ["inventory", "movements", productId] as const,
  batches: (productId: string) => ["inventory", "batches", productId] as const,
  expiry: (params: {
    page: number;
    search: string;
    status: ExpiryStatusFilter;
    sortBy?: string;
    sortOrder?: SortOrder;
  }) => ["inventory", "expiry", params] as const,
  report: (params: { search: string; stockStatus: StockStatus }) =>
    ["inventory", "report", params] as const,
};

export async function fetchInventory(params: {
  page: number;
  pageSize: number;
  search: string;
  stockStatus: StockStatus;
  excludeHiddenCategories?: boolean;
  sortBy?: string;
  sortOrder?: SortOrder;
}): Promise<PaginatedResponse<Product>> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) query.set("search", params.search);
  if (params.stockStatus !== "all") query.set("stockStatus", params.stockStatus);
  if (params.excludeHiddenCategories) query.set("excludeHiddenCategories", "true");
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);

  const res = await fetch(`${API_URL}/inventory?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch inventory");
  return res.json();
}

/**
 * Every product matching search/stockStatus, not just one page — for the
 * Inventory Stock report, whose CSV export must cover everything the filters
 * select rather than silently truncating at some page size. Reads `total`
 * from a cheap first page, then re-fetches sized to it in one more request.
 */
export async function fetchAllInventory(params: {
  search: string;
  stockStatus: StockStatus;
  excludeHiddenCategories?: boolean;
}): Promise<Product[]> {
  const first = await fetchInventory({ ...params, page: 1, pageSize: 1 });
  if (first.total <= 1) return first.items;

  const all = await fetchInventory({ ...params, page: 1, pageSize: first.total });
  return all.items;
}

export async function fetchInventorySummary(): Promise<InventorySummary> {
  const res = await fetch(`${API_URL}/inventory/summary`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch inventory summary");
  return res.json();
}

export async function fetchMovements(productId: string): Promise<PaginatedResponse<StockMovement>> {
  const res = await fetch(`${API_URL}/inventory/${productId}/movements`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch movements");
  return res.json();
}

export async function fetchBatches(productId: string): Promise<StockBatch[]> {
  const res = await fetch(`${API_URL}/inventory/${productId}/batches`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch stock batches");
  return res.json();
}

export async function fetchExpiryOverview(params: {
  page: number;
  pageSize: number;
  search: string;
  status: ExpiryStatusFilter;
  sortBy?: string;
  sortOrder?: SortOrder;
}): Promise<PaginatedResponse<ExpiryBatch>> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) query.set("search", params.search);
  if (params.status !== "all") query.set("status", params.status);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);

  const res = await fetch(`${API_URL}/inventory/expiry?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch expiry overview");
  return res.json();
}

export async function postStockIn(
  productId: string,
  data: {
    quantity: number;
    reason?: string;
    expiryDate?: string;
    costPrice?: number;
    sellingPrice?: number;
  },
): Promise<Product> {
  const res = await fetch(`${API_URL}/inventory/${productId}/stock-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Stock-in failed");
  }
  return res.json();
}

export async function updateBatch(
  productId: string,
  batchId: string,
  data: {
    quantity?: number;
    remainingQuantity?: number;
    costPrice?: number;
    sellingPrice?: number;
    expiryDate?: string | null;
    reason: string;
  },
): Promise<StockBatch> {
  const res = await fetch(`${API_URL}/inventory/${productId}/batches/${batchId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Batch correction failed");
  }
  return res.json();
}

export async function postAdjustment(
  productId: string,
  data: {
    quantity: number;
    reason: string;
    expiryDate?: string;
    costPrice?: number;
    sellingPrice?: number;
  },
): Promise<Product> {
  const res = await fetch(`${API_URL}/inventory/${productId}/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Adjustment failed");
  }
  return res.json();
}

export interface BulkSkipped {
  id: string;
  name: string;
  reason: string;
}

export async function postBulkMinimumStock(
  ids: string[],
  minimumStockLevel: number,
): Promise<{ updated: number }> {
  const res = await fetch(`${API_URL}/inventory/bulk/minimum-stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ids, minimumStockLevel }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Bulk update failed");
  }
  return res.json();
}

export async function postBulkStockIn(data: {
  ids: string[];
  quantity: number;
  reason?: string;
  expiryDate?: string;
  costPrice?: number;
  sellingPrice?: number;
}): Promise<{ succeeded: number; skipped: BulkSkipped[] }> {
  const res = await fetch(`${API_URL}/inventory/bulk/stock-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Bulk stock-in failed");
  }
  return res.json();
}

export async function postBulkAdjust(data: {
  ids: string[];
  quantity: number;
  reason: string;
}): Promise<{ succeeded: number; skipped: BulkSkipped[] }> {
  const res = await fetch(`${API_URL}/inventory/bulk/adjust`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Bulk adjustment failed");
  }
  return res.json();
}
