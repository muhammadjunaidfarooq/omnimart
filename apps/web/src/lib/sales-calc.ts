import type { DiscountType, PriceBatch } from "./catalog";

export interface CartCalcProduct {
  /** Ordered oldest-priced-first — see Product.priceBatches */
  priceBatches: PriceBatch[];
  /** Fallback when priceBatches is empty (no batches yet) — the product's own price, not a per-batch one */
  sellingPrice: number;
  taxRateBps: number;
  discountType: DiscountType | null;
  discountValue: number | null;
}

/**
 * Mirrors InventoryService.resolveLinePrice on the API
 * (apps/api/src/inventory/inventory.service.ts): walks batches oldest-first,
 * accumulating remaining stock until it would cover `quantity`, and returns
 * that batch's price for the whole line — so a line spanning a batch
 * boundary previews at the same price checkout will actually charge,
 * instead of understating it at the first (often cheaper, now-depleting)
 * batch's price alone.
 */
export function pickPriceForQuantity(batches: PriceBatch[], quantity: number, fallback: number): number {
  let remaining = quantity;
  for (const batch of batches) {
    remaining -= batch.remainingQuantity;
    if (remaining <= 0) return batch.sellingPrice;
  }
  return fallback;
}

export interface CartCalcLine {
  product: CartCalcProduct;
  quantity: number;
  discountType?: DiscountType;
  discountValue?: number;
  /** Cashier override for this line's unit price, in cents — this transaction only, never saved to the product. */
  unitPriceOverride?: number;
  /** Cashier override for this line's fixed total price, in cents — e.g. a bundle deal like "3 for 50". Mutually exclusive with unitPriceOverride; wins over both it and the resolved catalog price. */
  lineTotalOverride?: number;
}

/** The subset of BusinessSettings that affects discount computation. */
export interface CartCalcSettings {
  globalDiscountEnabled: boolean;
  globalDiscountType: DiscountType | null;
  globalDiscountValue: number | null;
}

export interface LineTotals {
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
}

/**
 * Mirrors SalesService.computeLine on the API (apps/api/src/sales/sales.service.ts)
 * so the cart's live preview matches what checkout will actually charge.
 * The server always recomputes this from scratch — this is display-only.
 */
export function computeLineTotals(line: CartCalcLine, settings?: CartCalcSettings): LineTotals {
  // A cashier-chosen override always wins; otherwise the global discount
  // (when enabled) applies to every product instead of its own discount.
  const discountType =
    line.discountType ??
    (settings?.globalDiscountEnabled ? settings.globalDiscountType : line.product.discountType);
  const discountValue = line.discountType
    ? line.discountValue ?? 0
    : settings?.globalDiscountEnabled
      ? settings.globalDiscountValue ?? 0
      : line.product.discountValue ?? 0;

  const sellingPrice =
    line.unitPriceOverride ??
    pickPriceForQuantity(line.product.priceBatches, line.quantity, line.product.sellingPrice);

  // A fixed total (e.g. a "3 for 50" bundle) replaces the usual unitPrice ×
  // quantity math outright — mirrors SalesService.computeLine on the API.
  // Quantity may otherwise be fractional (e.g. 0.25 kg); cents must stay
  // integer either way.
  const lineSubtotal = line.lineTotalOverride ?? Math.round(sellingPrice * line.quantity);
  const rawDiscount =
    discountType === "PERCENTAGE"
      ? Math.round((lineSubtotal * discountValue) / 10000)
      : discountType === "FIXED"
        ? discountValue
        : 0;
  // Clamp so a FIXED discount larger than the line, or a PERCENTAGE over
  // 100%, can never push the line (and therefore the bill) negative — mirrors
  // SalesService.computeLine on the API.
  const lineDiscount = Math.min(rawDiscount, lineSubtotal);
  const taxable = lineSubtotal - lineDiscount;
  const lineTax = Math.round((taxable * line.product.taxRateBps) / 10000);
  const lineTotal = taxable + lineTax;

  return { lineSubtotal, lineDiscount, lineTax, lineTotal };
}

export function computeCartTotals(lines: CartCalcLine[], settings?: CartCalcSettings) {
  const totals = lines.map((line) => computeLineTotals(line, settings));
  return {
    subtotal: totals.reduce((sum, t) => sum + t.lineSubtotal, 0),
    discountTotal: totals.reduce((sum, t) => sum + t.lineDiscount, 0),
    taxTotal: totals.reduce((sum, t) => sum + t.lineTax, 0),
    totalAmount: totals.reduce((sum, t) => sum + t.lineTotal, 0),
  };
}
