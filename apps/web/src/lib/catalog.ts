import type { PaginatedResponse } from "./api";

export interface Category {
  id: string;
  name: string;
  description: string | null;
  /** When true, cashiers never see this category or its products in the POS. */
  hiddenFromPos: boolean;
}

export interface Brand {
  id: string;
  name: string;
  description: string | null;
}

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  allowsFractionalQuantity: boolean;
}

export type DiscountType = "PERCENTAGE" | "FIXED";

/** One product's non-depleted batch, FEFO-ordered — lets the cart preview replay checkout's own pricing (see lib/sales-calc.ts's pickPriceForQuantity). */
export interface PriceBatch {
  remainingQuantity: number;
  sellingPrice: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  categoryId: string;
  category: Category;
  brandId: string | null;
  brand: Brand | null;
  unitId: string;
  unit: Unit;
  /** The default price new batches/stock-ins start from — editable via the catalog form. */
  costPrice: number;
  sellingPrice: number;
  /** What's actually charged right now — the active (oldest non-depleted) batch's price, falling back to costPrice/sellingPrice when there's no batch. Fine for a flat "starting from" display (e.g. the product grid tile), but a cart line's real total must use priceBatches instead — see pickPriceForQuantity. */
  activeCostPrice: number;
  activeSellingPrice: number;
  /** Ordered oldest-priced-first; empty when the product has no batches yet. */
  priceBatches: PriceBatch[];
  taxRateBps: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  minimumStockLevel: number;
  currentStock: number;
  /** Non-depleted batches valued at their own cost, plus any untracked stock at costPrice — only populated by the inventory list/summary endpoints. */
  stockValue?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type StockMovementType = "IN" | "OUT" | "ADJUSTMENT";

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantity: number;
  reason: string | null;
  userId: string;
  user: { id: string; name: string };
  createdAt: string;
}

export interface InventorySummary {
  outOfStockCount: number;
  lowStockCount: number;
  totalStockValue: number;
}

export type StockStatus = "all" | "low" | "out";

/** NO_EXPIRY only appears in a single product's batch list; the cross-product Expiry view only ever shows dated batches. */
export type ExpiryStatus = "EXPIRED" | "EXPIRING_SOON" | "GOOD" | "NO_EXPIRY";

export interface StockBatch {
  id: string;
  productId: string;
  quantity: number;
  remainingQuantity: number;
  costPrice: number;
  sellingPrice: number;
  expiryDate: string | null;
  reason: string | null;
  createdById: string;
  createdBy: { id: string; name: string };
  createdAt: string;
  status: ExpiryStatus;
}

export interface ExpiryBatch extends StockBatch {
  product: Product;
}

export type ExpiryStatusFilter = "all" | "expired" | "expiring_soon" | "good";

export function productImageSrc(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  return `${API_URL}${imageUrl}`;
}

export async function fetchProduct(id: string): Promise<Product> {
  const res = await fetch(`${API_URL}/products/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch product");
  return res.json();
}

export const productKeys = {
  list: (params: { page: number; search: string }) => ["products", "list", params] as const,
};

/**
 * Paginated product search with priceBatches/activeSellingPrice attached
 * (see ProductsService.attachActivePrices) — unlike GET /inventory, which
 * only adds stockValue. Use this, not lib/inventory.ts's fetchInventory/
 * fetchAllInventory, wherever a cart line needs to be priced (e.g. bulk sale).
 */
export async function fetchProducts(params: {
  page: number;
  pageSize: number;
  search: string;
}): Promise<PaginatedResponse<Product>> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
  });
  if (params.search) query.set("search", params.search);

  const res = await fetch(`${API_URL}/products?${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}
