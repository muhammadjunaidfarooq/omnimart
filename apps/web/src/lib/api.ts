import { cookies } from "next/headers";
import type { CurrentUser } from "./auth";
import type { ExpiryBatch, ExpiryStatusFilter, InventorySummary, Product, StockStatus } from "./catalog";
import type { BorrowerBillsParams, BorrowerStatement } from "./khata";
import type { Sale } from "./sales";
import type { BusinessSettings } from "./settings";

const DEFAULT_SETTINGS: BusinessSettings = {
  id: 1,
  storeName: "My Store",
  logoUrl: null,
  address: null,
  phone: null,
  email: null,
  currencyCode: "USD",
  currencySymbol: "$",
  defaultTaxRateBps: 0,
  taxLabel: "Tax",
  expiryWarningDays: 30,
  invoiceFooterNote: null,
  showLogoOnInvoice: true,
  globalDiscountEnabled: false,
  globalDiscountType: null,
  globalDiscountValue: null,
  updatedAt: new Date(0).toISOString(),
};

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function serverFetch(path: string) {
  const cookieStore = await cookies();
  return fetch(`${API_URL}${path}`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const res = await serverFetch('/auth/me');

  if (!res.ok) {
    return null;
  }

  return res.json();
}

export async function getProduct(id: string): Promise<Product | null> {
  const res = await serverFetch(`/products/${id}`);
  if (!res.ok) return null;
  return res.json();
}

/** Every active product, grouped by category — powers the admin "Download Price List" print page. */
export async function getPriceListProducts(): Promise<Product[]> {
  const res = await serverFetch("/products/price-list");
  if (!res.ok) return [];
  return res.json();
}

export async function getInventory(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  stockStatus?: StockStatus;
  excludeHiddenCategories?: boolean;
  sortBy?: string;
  sortOrder?: string;
}): Promise<PaginatedResponse<Product>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search) query.set("search", params.search);
  if (params.stockStatus && params.stockStatus !== "all") query.set("stockStatus", params.stockStatus);
  if (params.excludeHiddenCategories) query.set("excludeHiddenCategories", "true");
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);

  const res = await serverFetch(`/inventory?${query}`);
  if (!res.ok) return { items: [], total: 0, page: 1, pageSize: 20 };
  return res.json();
}

/**
 * Every product matching the filters, not just one page — mirrors
 * lib/inventory.ts's fetchAllInventory (same "cheap first page for the
 * total, then one more request sized to it" trick), for the server-rendered
 * Inventory Stock Report PDF print page.
 */
export async function getAllInventory(params: {
  search?: string;
  stockStatus?: StockStatus;
  excludeHiddenCategories?: boolean;
}): Promise<Product[]> {
  const first = await getInventory({ ...params, page: 1, pageSize: 1 });
  if (first.total <= 1) return first.items;
  return (await getInventory({ ...params, page: 1, pageSize: first.total })).items;
}

export async function getInventorySummary(): Promise<InventorySummary> {
  const res = await serverFetch("/inventory/summary");
  if (!res.ok) return { outOfStockCount: 0, lowStockCount: 0, totalStockValue: 0 };
  return res.json();
}

export async function getExpiryOverview(params: {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: ExpiryStatusFilter;
  sortBy?: string;
  sortOrder?: string;
}): Promise<PaginatedResponse<ExpiryBatch>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.search) query.set("search", params.search);
  if (params.status && params.status !== "all") query.set("status", params.status);
  if (params.sortBy) query.set("sortBy", params.sortBy);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);

  const res = await serverFetch(`/inventory/expiry?${query}`);
  if (!res.ok) return { items: [], total: 0, page: 1, pageSize: 20 };
  return res.json();
}

export async function getSale(id: string): Promise<Sale | null> {
  const res = await serverFetch(`/sales/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getBorrowerStatement(
  id: string,
  params: BorrowerBillsParams,
): Promise<BorrowerStatement | null> {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);

  const res = await serverFetch(`/khata/borrowers/${id}/statement?${query}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getSettings(): Promise<BusinessSettings> {
  const res = await serverFetch("/settings");
  if (!res.ok) return DEFAULT_SETTINGS;
  return res.json();
}
