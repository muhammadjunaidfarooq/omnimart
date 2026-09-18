"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CartPanel, PricedEntryDialog } from "@/components/cashier/cart-panel";
import { CartProvider, makeLineId, useCart } from "@/components/cashier/cart-context";
import { usePosShortcuts } from "@/components/cashier/use-pos-shortcuts";
import { Card } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { fetchProducts, productKeys, type Product } from "@/lib/catalog";
import { formatMoney, inputToCents } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";

const PAGE_SIZE = 20;

function PosShortcutsListener() {
  usePosShortcuts();
  return null;
}

/**
 * Direct numeric quantity entry for one product row — an alternative to
 * ProductGrid's click-to-add-one, since a bulk sale is set up by typing
 * quantities across many products rather than tapping tiles repeatedly.
 * Adds the line on first non-zero entry and removes it when cleared to
 * zero/blank, same as CartLineRow's own quantity field (cart-panel.tsx).
 */
function QuantityCell({ product }: { product: Product }) {
  const cart = useCart();
  // Only the product's plain line — a priced-entry line (a fixed-price tier
  // added via the "Priced entry" column) stays independent and untouched by
  // this cell, same product or not.
  const line = cart.lines.find((l) => l.product.id === product.id && l.lineTotalOverride == null);
  const isFractional = product.unit.allowsFractionalQuantity;
  // Decoupled from the committed cart quantity so clearing the field to type
  // a new number doesn't instantly redisplay a clamped value mid-edit.
  const [input, setInput] = useState<string | null>(null);

  function clampToStock(quantity: number): number {
    // Not just currentStock — an Amount-entry or priced-entry line for the
    // same product (see AmountCell/PricedEntryCell) already reserves some of
    // it, so what's left for this line can be less than the full stock.
    const available = cart.availableStock(product, line?.lineId);
    if (quantity > available) {
      toast.error(`Only ${available} ${product.unit.abbreviation} of ${product.name} available.`);
      return available;
    }
    return quantity;
  }

  function handleChange(value: string) {
    setInput(value);
    const parsed = isFractional ? Number.parseFloat(value) : Number.parseInt(value, 10);
    if (!value.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      if (line) cart.removeProduct(product.id);
      return;
    }
    cart.setProductQuantity(product, clampToStock(parsed));
  }

  return (
    <Input
      type="number"
      min={isFractional ? "0.001" : "1"}
      step={isFractional ? "0.001" : "1"}
      placeholder="0"
      value={input ?? (line ? String(line.quantity) : "")}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => setInput(null)}
      disabled={product.currentStock <= 0}
      className="ml-auto h-8 w-24 text-center"
    />
  );
}

/**
 * For fractional (weight/volume) units — type an amount and let the system
 * work out the quantity from the product's selling price, instead of
 * weighing/estimating a quantity by hand (e.g. customer wants Rs 50 of
 * sugar). Recorded as its own cart line (see CartLine.amountEntry) —
 * separate from the plain quantity line (QuantityCell) and any priced-entry
 * bundle for the same product — but all still drawn from the same stock.
 * Mirrors CartLineRow's own Amount field (cart-panel.tsx), which instead
 * edits a line already in the cart. Not offered for whole-unit products,
 * where quantity is always the direct entry.
 *
 * Each focus-to-blur session records its own line, same as a priced entry —
 * re-using this field for the same product after blurring adds another
 * amount-entry line rather than overwriting the last one.
 */
function AmountCell({ product }: { product: Product }) {
  const cart = useCart();
  // One-directional (amount -> quantity), same as CartLineRow's Amount field
  // — there's no rupee amount stored on the line to redisplay, so the field
  // always starts blank and clears itself again on blur.
  const [input, setInput] = useState<string | null>(null);
  // The line this in-progress entry created, if any — kept only while the
  // field is being typed into. Reset on blur so the next entry starts a new
  // line instead of continuing to edit this one.
  const [activeLineId, setActiveLineId] = useState<string | null>(null);

  if (!product.unit.allowsFractionalQuantity) {
    return <span className="text-muted-foreground">—</span>;
  }

  function handleChange(value: string) {
    setInput(value);
    const amountCents = inputToCents(value);
    if (!value.trim() || amountCents <= 0) {
      if (activeLineId) {
        cart.removeLine(activeLineId);
        setActiveLineId(null);
      }
      return;
    }
    if (product.activeSellingPrice <= 0) return;
    const rawQuantity = Math.round((amountCents / product.activeSellingPrice) * 1000) / 1000;
    // Not just currentStock — the plain quantity line, a priced-entry
    // bundle, or an earlier amount-entry line for the same product (see
    // QuantityCell/PricedEntryCell) may already reserve some of it.
    const available = cart.availableStock(product, activeLineId ?? undefined);
    const quantity = Math.min(rawQuantity, available);
    if (quantity < rawQuantity) {
      toast.error(`Only ${available} ${product.unit.abbreviation} of ${product.name} available.`);
    }
    // If stock clamped the quantity down, the total must shrink with it —
    // otherwise the line would charge the full typed amount for less than
    // was actually asked for.
    const lineTotalOverride = quantity === rawQuantity ? amountCents : Math.round(product.activeSellingPrice * quantity);
    if (activeLineId) {
      cart.setLineTotalOverride(activeLineId, quantity, lineTotalOverride);
    } else {
      const lineId = makeLineId();
      cart.addAmountLine(product, quantity, lineTotalOverride, lineId);
      setActiveLineId(lineId);
    }
  }

  return (
    <Input
      type="number"
      step="0.01"
      min="0"
      placeholder="e.g. 50"
      value={input ?? ""}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => {
        setInput(null);
        setActiveLineId(null);
      }}
      disabled={product.currentStock <= 0}
      className="ml-auto h-8 w-24 text-center"
    />
  );
}

/**
 * Trigger for a fixed-price bundle entry (e.g. "3 for 50") — a separate cart
 * line from the plain quantity cell above, so a product can be sold at both
 * its normal price and a tiered price in the same sale.
 */
function PricedEntryCell({ product }: { product: Product }) {
  return (
    <PricedEntryDialog
      product={product}
      trigger={
        <Button variant="outline" size="icon-sm" disabled={product.currentStock <= 0} title="Add priced entry">
          <Tag className="size-3.5" />
        </Button>
      }
    />
  );
}

function BulkSaleProductTable() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const currencySymbol = useCurrencySymbol();

  // GET /products, not GET /inventory — only this one attaches
  // priceBatches/activeSellingPrice, which the cart needs to price a line
  // the same way checkout will (see lib/catalog.ts's fetchProducts).
  const { data, isLoading, isFetching } = useQuery({
    queryKey: productKeys.list({ page, search }),
    queryFn: () => fetchProducts({ page, pageSize: PAGE_SIZE, search }),
    placeholderData: (prev) => prev,
  });

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: DataTableColumn<Product>[] = [
    {
      header: "Product",
      cell: (p) => (
        <>
          <p className="font-medium">{p.name}</p>
          <p className="text-xs text-muted-foreground">{p.category.name}</p>
        </>
      ),
    },
    {
      header: "SKU",
      cellClassName: "font-mono text-sm",
      cell: (p) => p.sku,
    },
    {
      header: "Stock",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (p) => (
        <>
          {p.currentStock} <span className="text-xs text-muted-foreground">{p.unit.abbreviation}</span>
        </>
      ),
    },
    {
      header: "Price",
      headerClassName: "text-right",
      cellClassName: "text-right font-mono text-sm",
      cell: (p) => formatMoney(p.activeSellingPrice, currencySymbol),
    },
    {
      header: "Quantity",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (p) => <QuantityCell product={p} />,
    },
    {
      header: `Amount (${currencySymbol})`,
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (p) => <AmountCell product={p} />,
    },
    {
      header: "Priced entry",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (p) => <PricedEntryCell product={p} />,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          id="pos-search"
          className="pl-9"
          placeholder="Search by name or SKU…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>
      <div className={`transition-opacity ${isFetching ? "opacity-70" : ""}`}>
        <DataTable
          columns={columns}
          rows={products}
          isLoading={isLoading}
          emptyMessage="No products found."
          keyExtractor={(p) => p.id}
        />
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  /**
   * Where the completed sale's invoice lives — defaults to the admin
   * invoice view (with refund support). The cashier Bulk Sale page passes
   * "/cashier/sales" instead. A plain string, not a function, because the
   * Server Component page that renders this can't pass a function prop
   * across the client-component boundary.
   */
  invoiceBasePath?: string;
}

/**
 * Records one sale across many products at once — set a quantity per
 * product in the list on the left, then use the price override, discount,
 * and checkout tools on the right, all reused as-is from the POS cart (same
 * ledger, invoice, and khata flow as a normal sale). Used by both the admin
 * Inventory section and the cashier POS.
 */
export function BulkSaleWorkspace({ invoiceBasePath = "/admin/sales" }: Props = {}) {
  return (
    <CartProvider>
      <PosShortcutsListener />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:items-start">
        <Card className="min-w-0 p-4">
          <BulkSaleProductTable />
        </Card>
        <Card className="flex flex-col p-4">
          <CartPanel invoiceHref={(saleId) => `${invoiceBasePath}/${saleId}`} />
        </Card>
      </div>
      <p className="pt-3 text-center text-xs text-muted-foreground">
        F1 search · F3 hold bill · F4 checkout · F5 cash · F6 transfer
      </p>
    </CartProvider>
  );
}
