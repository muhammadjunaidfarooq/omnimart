"use client";

import { createContext, useContext, useMemo, useReducer } from "react";
import type { DiscountType, Product } from "@/lib/catalog";
import type { CartLineInput } from "@/lib/sales";
import { computeCartTotals, computeLineTotals } from "@/lib/sales-calc";
import { useBusinessSettings } from "@/lib/settings";

export interface CartLine {
  /** Client-only identity for this line — never sent to the API, which keys purely by array position. Lets two lines for the same product coexist (see lineTotalOverride) without one edit clobbering the other. */
  lineId: string;
  product: Product;
  quantity: number;
  discountType?: DiscountType;
  discountValue?: number;
  /** Cashier override for this line's unit price, in cents — this transaction only, never saved to the product. */
  unitPriceOverride?: number;
  /**
   * Cashier override for this line's fixed total price, in cents — for a
   * quantity-based bundle price (e.g. "3 for 50") that isn't a whole-cent
   * unit price. Mutually exclusive with unitPriceOverride. A line carrying
   * this is a "priced entry": it always stands on its own (ADD_ITEM/
   * SET_PRODUCT_QUANTITY never merge into it, and never merge a later plain
   * add into it either) so the same product can appear multiple times with
   * different tier prices, all still drawing from the same stock.
   */
  lineTotalOverride?: number;
  /**
   * Marks a line as created from a Rs-amount entry (Bulk Sale's Amount
   * column) — quantity worked out from the amount, lineTotalOverride set to
   * the amount itself. Kept separate from both the plain quantity line and
   * any manual priced-entry bundle for the same product (ADD_ITEM/
   * SET_PRODUCT_QUANTITY never merge into it). Each amount entry also always
   * stands on its own (ADD_AMOUNT_LINE never merges into a prior amount
   * line), so re-using the Amount field for the same product records a new
   * line instead of overwriting the last one — same rule as a priced entry.
   * All can coexist for one product, each drawing from the same stock.
   */
  amountEntry?: boolean;
}

interface CartState {
  draftId: string | null;
  lines: CartLine[];
}

type CartAction =
  | { type: "ADD_ITEM"; product: Product }
  | { type: "ADD_PRICED_LINE"; product: Product; quantity: number; lineTotalOverride: number }
  | { type: "SET_PRODUCT_QUANTITY"; product: Product; quantity: number }
  | { type: "REMOVE_PRODUCT"; productId: string }
  | { type: "SET_LINE_QUANTITY"; lineId: string; quantity: number }
  | { type: "SET_LINE_TOTAL_OVERRIDE"; lineId: string; quantity: number; lineTotalOverride: number }
  | { type: "ADD_AMOUNT_LINE"; lineId: string; product: Product; quantity: number; lineTotalOverride: number }
  | { type: "REMOVE_LINE"; lineId: string }
  | {
      type: "SET_DISCOUNT";
      lineId: string;
      discountType?: DiscountType;
      discountValue?: number;
    }
  | { type: "SET_PRICE_OVERRIDE"; lineId: string; unitPriceOverride?: number }
  | { type: "CLEAR" }
  | { type: "REPLACE"; draftId: string | null; lines: CartLine[] };

const initialState: CartState = { draftId: null, lines: [] };

/** Generates a client-only line id — exported so a caller that needs to know a new line's id up front (e.g. Bulk Sale's Amount column, to keep editing that same line while the entry is still in progress) can pass it into addAmountLine instead of the reducer minting one it can't hand back. */
export function makeLineId(): string {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `line-${Math.random().toString(36).slice(2)}`;
}

/** The line a plain (non-priced-entry) add/quantity-set for this product should target — never a priced-entry line, so those always stay independent. */
function findPlainLine(lines: CartLine[], productId: string): CartLine | undefined {
  return lines.find((l) => l.product.id === productId && l.lineTotalOverride == null);
}

/**
 * How much of a product's stock every *other* line already reserves — a
 * product can appear as a plain line, one or more priced-entry bundles, and
 * an amount-entry line all at once, and they all draw from the same stock,
 * so none of them may be sized against the product's full currentStock in
 * isolation. Pass the line being changed's id (or undefined for a
 * not-yet-created line) so it doesn't reserve against itself.
 */
function otherLinesQuantity(lines: CartLine[], productId: string, excludeLineId?: string): number {
  return lines
    .filter((l) => l.product.id === productId && l.lineId !== excludeLineId)
    .reduce((sum, l) => sum + l.quantity, 0);
}

/** Stock left for a product once every other line's reservation is subtracted — never negative. */
function availableStockFor(lines: CartLine[], product: Product, excludeLineId?: string): number {
  return Math.max(0, product.currentStock - otherLinesQuantity(lines, product.id, excludeLineId));
}

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM": {
      const existing = findPlainLine(state.lines, action.product.id);
      const available = availableStockFor(state.lines, action.product, existing?.lineId);
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) =>
            l.lineId === existing.lineId ? { ...l, quantity: Math.min(l.quantity + 1, available) } : l,
          ),
        };
      }
      return {
        ...state,
        lines: [...state.lines, { lineId: makeLineId(), product: action.product, quantity: Math.min(1, available) }],
      };
    }
    case "ADD_PRICED_LINE": {
      const available = availableStockFor(state.lines, action.product);
      return {
        ...state,
        lines: [
          ...state.lines,
          {
            lineId: makeLineId(),
            product: action.product,
            quantity: Math.min(action.quantity, available),
            lineTotalOverride: action.lineTotalOverride,
          },
        ],
      };
    }
    case "SET_PRODUCT_QUANTITY": {
      const min = action.product.unit.allowsFractionalQuantity ? 0.001 : 1;
      const existing = findPlainLine(state.lines, action.product.id);
      const available = availableStockFor(state.lines, action.product, existing?.lineId);
      const quantity = Math.min(Math.max(min, action.quantity), available);
      if (existing) {
        return {
          ...state,
          lines: state.lines.map((l) => (l.lineId === existing.lineId ? { ...l, quantity } : l)),
        };
      }
      return {
        ...state,
        lines: [...state.lines, { lineId: makeLineId(), product: action.product, quantity }],
      };
    }
    case "ADD_AMOUNT_LINE": {
      const available = availableStockFor(state.lines, action.product);
      return {
        ...state,
        lines: [
          ...state.lines,
          {
            lineId: action.lineId,
            product: action.product,
            quantity: Math.min(action.quantity, available),
            lineTotalOverride: action.lineTotalOverride,
            amountEntry: true,
          },
        ],
      };
    }
    case "REMOVE_PRODUCT":
      return {
        ...state,
        lines: state.lines.filter((l) => !(l.product.id === action.productId && l.lineTotalOverride == null)),
      };
    case "SET_LINE_QUANTITY": {
      // Emptying or zeroing the quantity input must never remove the line —
      // only the delete button (REMOVE_LINE) does that. Clamp to the line's
      // minimum, and never above what's actually available once every other
      // line for the same product is accounted for (the last line of
      // defense — call sites should already warn the cashier before this).
      return {
        ...state,
        lines: state.lines.map((l) => {
          if (l.lineId !== action.lineId) return l;
          const min = l.product.unit.allowsFractionalQuantity ? 0.001 : 1;
          const available = availableStockFor(state.lines, l.product, l.lineId);
          return { ...l, quantity: Math.min(Math.max(min, action.quantity), available) };
        }),
      };
    }
    case "SET_LINE_TOTAL_OVERRIDE":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.lineId === action.lineId
            ? {
                ...l,
                quantity: Math.min(action.quantity, availableStockFor(state.lines, l.product, l.lineId)),
                lineTotalOverride: action.lineTotalOverride,
              }
            : l,
        ),
      };
    case "REMOVE_LINE":
      return { ...state, lines: state.lines.filter((l) => l.lineId !== action.lineId) };
    case "SET_DISCOUNT":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.lineId === action.lineId
            ? { ...l, discountType: action.discountType, discountValue: action.discountValue }
            : l,
        ),
      };
    case "SET_PRICE_OVERRIDE":
      return {
        ...state,
        lines: state.lines.map((l) =>
          l.lineId === action.lineId ? { ...l, unitPriceOverride: action.unitPriceOverride } : l,
        ),
      };
    case "CLEAR":
      return initialState;
    case "REPLACE":
      return { draftId: action.draftId, lines: action.lines };
    default:
      return state;
  }
}

interface CartContextValue {
  draftId: string | null;
  lines: CartLine[];
  /** Tap-to-add-one — merges into the product's existing plain line, if any. */
  addItem: (product: Product) => void;
  /** Always creates a new, independent line — used for a tiered/bundle price (e.g. "3 for 50") so it never merges with other lines of the same product. */
  addPricedLine: (product: Product, quantity: number, lineTotalOverride: number) => void;
  /** Finds-or-creates the product's plain line and sets its quantity directly — for a direct numeric-entry UI (e.g. Bulk Sale's quantity column). */
  setProductQuantity: (product: Product, quantity: number) => void;
  /** Always creates a new, independent amount-entry line (see CartLine.amountEntry) — for Bulk Sale's Amount column, so re-entering an amount for the same product records another line rather than overwriting the last one. Caller supplies the lineId so it can keep editing that same line (via setLineTotalOverride) while the entry is still in progress. Independent of the plain quantity line and any priced-entry bundles for the same product. */
  addAmountLine: (product: Product, quantity: number, lineTotalOverride: number, lineId: string) => void;
  /** Removes the product's plain line, if any — leaves any priced-entry or amount-entry lines for it untouched. */
  removeProduct: (productId: string) => void;
  setLineQuantity: (lineId: string, quantity: number) => void;
  /** Edits an existing priced-entry line's quantity and fixed total together. */
  setLineTotalOverride: (lineId: string, quantity: number, lineTotalOverride: number) => void;
  removeLine: (lineId: string) => void;
  setDiscount: (lineId: string, discountType?: DiscountType, discountValue?: number) => void;
  setPriceOverride: (lineId: string, unitPriceOverride?: number) => void;
  /** Stock still free for a product once every other line for it (plain, priced-entry, or amount-entry) is subtracted — pass the line being edited's id to exclude it from its own reservation. Lets a UI warn/clamp accurately when a product has more than one line drawing from the same stock. */
  availableStock: (product: Product, excludeLineId?: string) => number;
  clear: () => void;
  replace: (draftId: string | null, lines: CartLine[]) => void;
  toCartLineInputs: () => CartLineInput[];
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const value = useMemo<CartContextValue>(
    () => ({
      draftId: state.draftId,
      lines: state.lines,
      addItem: (product) => dispatch({ type: "ADD_ITEM", product }),
      addPricedLine: (product, quantity, lineTotalOverride) =>
        dispatch({ type: "ADD_PRICED_LINE", product, quantity, lineTotalOverride }),
      setProductQuantity: (product, quantity) => dispatch({ type: "SET_PRODUCT_QUANTITY", product, quantity }),
      addAmountLine: (product, quantity, lineTotalOverride, lineId) =>
        dispatch({ type: "ADD_AMOUNT_LINE", lineId, product, quantity, lineTotalOverride }),
      removeProduct: (productId) => dispatch({ type: "REMOVE_PRODUCT", productId }),
      setLineQuantity: (lineId, quantity) => dispatch({ type: "SET_LINE_QUANTITY", lineId, quantity }),
      setLineTotalOverride: (lineId, quantity, lineTotalOverride) =>
        dispatch({ type: "SET_LINE_TOTAL_OVERRIDE", lineId, quantity, lineTotalOverride }),
      removeLine: (lineId) => dispatch({ type: "REMOVE_LINE", lineId }),
      setDiscount: (lineId, discountType, discountValue) =>
        dispatch({ type: "SET_DISCOUNT", lineId, discountType, discountValue }),
      setPriceOverride: (lineId, unitPriceOverride) =>
        dispatch({ type: "SET_PRICE_OVERRIDE", lineId, unitPriceOverride }),
      availableStock: (product, excludeLineId) => availableStockFor(state.lines, product, excludeLineId),
      clear: () => dispatch({ type: "CLEAR" }),
      replace: (draftId, lines) => dispatch({ type: "REPLACE", draftId, lines }),
      toCartLineInputs: () =>
        state.lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          discountType: l.discountType,
          discountValue: l.discountValue,
          unitPriceOverride: l.unitPriceOverride,
          lineTotalOverride: l.lineTotalOverride,
        })),
    }),
    [state],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}

export function useCartTotals() {
  const { lines } = useCart();
  const settings = useBusinessSettings();
  return useMemo(() => computeCartTotals(lines, settings), [lines, settings]);
}

export function useCartLineTotals(line: CartLine) {
  const settings = useBusinessSettings();
  return useMemo(() => computeLineTotals(line, settings), [line, settings]);
}
