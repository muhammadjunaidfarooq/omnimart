"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DollarSign, Minus, Percent, Plus, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DiscountType, Product } from "@/lib/catalog";
import { bpsToPercentInput, centsToInput, formatMoney, inputToCents, percentInputToBps } from "@/lib/money";
import { salesKeys, saveDraft } from "@/lib/sales";
import { useCartLineTotals, useCartTotals, type CartLine, useCart } from "./cart-context";
import { CheckoutDialog } from "./checkout-dialog";

const NO_OVERRIDE = "none";

function LineDiscountDialog({ line }: { line: CartLine }) {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<string>(line.discountType ?? NO_OVERRIDE);
  const [value, setValue] = useState(
    line.discountValue != null
      ? line.discountType === "PERCENTAGE"
        ? bpsToPercentInput(line.discountValue)
        : centsToInput(line.discountValue)
      : "",
  );

  function handleOpenChange(next: boolean) {
    if (next) {
      setType(line.discountType ?? NO_OVERRIDE);
      setValue(
        line.discountValue != null
          ? line.discountType === "PERCENTAGE"
            ? bpsToPercentInput(line.discountValue)
            : centsToInput(line.discountValue)
          : "",
      );
    }
    setOpen(next);
  }

  function handleSave() {
    if (type === NO_OVERRIDE) {
      cart.setDiscount(line.lineId, undefined, undefined);
    } else {
      const discountValue = type === "PERCENTAGE" ? percentInputToBps(value) : inputToCents(value);
      cart.setDiscount(line.lineId, type as DiscountType, discountValue);
    }
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button variant="ghost" size="icon-sm" title="Discount override">
          <Percent className="size-3.5" />
        </Button>
      }
      title={`Discount — ${line.product.name}`}
      footer={<Button onClick={handleSave}>Save</Button>}
      size="sm"
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="line-discount-type">Override</Label>
          <Select value={type} onValueChange={(v) => v && setType(v)}>
            <SelectTrigger id="line-discount-type" className="w-full">
              <SelectValue>
                {(v: string) =>
                  v === "PERCENTAGE" ? "Percentage" : v === "FIXED" ? "Fixed amount" : "Use catalog discount"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_OVERRIDE}>Use catalog discount</SelectItem>
              <SelectItem value="PERCENTAGE">Percentage</SelectItem>
              <SelectItem value="FIXED">Fixed amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {type !== NO_OVERRIDE && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="line-discount-value">
              {type === "PERCENTAGE" ? "Discount (%)" : "Discount amount"}
            </Label>
            <Input
              id="line-discount-value"
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        )}
      </div>
    </Modal>
  );
}

function LinePriceOverrideDialog({ line }: { line: CartLine }) {
  const cart = useCart();
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(
    line.unitPriceOverride != null ? centsToInput(line.unitPriceOverride) : "",
  );

  function handleOpenChange(next: boolean) {
    if (next) {
      setPrice(line.unitPriceOverride != null ? centsToInput(line.unitPriceOverride) : "");
    }
    setOpen(next);
  }

  function handleSave() {
    if (!price.trim()) {
      cart.setPriceOverride(line.lineId, undefined);
      setOpen(false);
      return;
    }
    const cents = inputToCents(price);
    if (cents < line.product.activeCostPrice) {
      toast.error(`Price can't be below cost price (${formatMoney(line.product.activeCostPrice)}).`);
      return;
    }
    cart.setPriceOverride(line.lineId, cents);
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button variant="ghost" size="icon-sm" title="Price override">
          <DollarSign className="size-3.5" />
        </Button>
      }
      title={`Price — ${line.product.name}`}
      footer={<Button onClick={handleSave}>Save</Button>}
      size="sm"
    >
      <div className="flex flex-col gap-2 pt-2">
        <Label htmlFor="line-price-override">Unit price for this sale</Label>
        <Input
          id="line-price-override"
          type="number"
          step="0.01"
          min={centsToInput(line.product.activeCostPrice)}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder={centsToInput(line.product.activeSellingPrice)}
        />
        <p className="text-xs text-muted-foreground">
          Applies to this transaction only. Can&apos;t go below cost price (
          {formatMoney(line.product.activeCostPrice)}). Leave blank to use the current price (
          {formatMoney(line.product.activeSellingPrice)}).
        </p>
      </div>
    </Modal>
  );
}

interface PricedEntryDialogProps {
  product: Product;
  /** Present when editing an existing priced-entry line; omitted when adding a brand new one. */
  line?: CartLine;
  trigger: React.ReactElement;
}

/**
 * Records a fixed-price bundle for a product — e.g. "3 for 50" — as its own
 * cart line, independent of any other line for the same product (a plain
 * per-unit line, or another tier). Used both to add a new one (from Bulk
 * Sale's product table) and to edit an existing one (from CartLineRow).
 */
export function PricedEntryDialog({ product, line, trigger }: PricedEntryDialogProps) {
  const cart = useCart();
  const isFractional = product.unit.allowsFractionalQuantity;
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(line ? String(line.quantity) : "");
  const [totalPrice, setTotalPrice] = useState(
    line?.lineTotalOverride != null ? centsToInput(line.lineTotalOverride) : "",
  );

  function handleOpenChange(next: boolean) {
    if (next) {
      setQuantity(line ? String(line.quantity) : "");
      setTotalPrice(line?.lineTotalOverride != null ? centsToInput(line.lineTotalOverride) : "");
    }
    setOpen(next);
  }

  function handleSave() {
    const parsedQuantity = isFractional ? Number.parseFloat(quantity) : Number.parseInt(quantity, 10);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      toast.error("Enter a quantity.");
      return;
    }
    // Not just currentStock — the plain quantity line, an amount-entry line,
    // or another priced-entry tier for the same product may already reserve
    // some of it.
    const available = cart.availableStock(product, line?.lineId);
    if (parsedQuantity > available) {
      toast.error(`Only ${available} ${product.unit.abbreviation} of ${product.name} available.`);
      return;
    }
    const cents = inputToCents(totalPrice);
    if (cents <= 0) {
      toast.error("Enter a total price.");
      return;
    }
    if (cents < product.activeCostPrice * parsedQuantity) {
      toast.error(`Total can't be below cost price (${formatMoney(product.activeCostPrice * parsedQuantity)}).`);
      return;
    }
    if (line) {
      cart.setLineTotalOverride(line.lineId, parsedQuantity, cents);
    } else {
      cart.addPricedLine(product, parsedQuantity, cents);
    }
    setOpen(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      title={`Priced entry — ${product.name}`}
      footer={<Button onClick={handleSave}>{line ? "Save" : "Add"}</Button>}
      size="sm"
    >
      <div className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="priced-entry-quantity">Quantity</Label>
          <Input
            id="priced-entry-quantity"
            type="number"
            step={isFractional ? "0.001" : "1"}
            min={isFractional ? "0.001" : "1"}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="priced-entry-total">Total price for this quantity</Label>
          <Input
            id="priced-entry-total"
            type="number"
            step="0.01"
            min="0"
            placeholder="e.g. 50"
            value={totalPrice}
            onChange={(e) => setTotalPrice(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {`For a tiered deal like "3 for 50", enter 3 as the quantity and 50 as the total price. Recorded as its own line — separate from any other ${product.name} already in the cart — but drawn from the same stock.`}
        </p>
      </div>
    </Modal>
  );
}

function CartLineRow({ line }: { line: CartLine }) {
  const cart = useCart();
  const totals = useCartLineTotals(line);
  const isFractional = line.product.unit.allowsFractionalQuantity;
  const isPricedEntry = line.lineTotalOverride != null && !line.amountEntry;
  // Set from Bulk Sale's Amount column — quantity and total already worked
  // out from what was typed there, so this line's quantity/total are edited
  // by retyping the amount there too, same as a priced entry can't be
  // steppered without going stale (see the quantity block below).
  const isAmountEntry = line.amountEntry === true;
  const step = isFractional ? 0.25 : 1;
  // Lets the cashier type "customer wants 100 worth of sugar" and have the
  // quantity worked out automatically, instead of weighing/estimating it.
  // One-directional (amount -> quantity) to avoid live-reformatting fights
  // with the quantity input — cleared whenever quantity changes some other
  // way so it never shows a stale amount next to the current quantity.
  const [amountInput, setAmountInput] = useState("");
  // Mirrors amountInput's role: what the quantity field displays while being
  // edited, decoupled from the committed (and min-clamped) cart quantity.
  // Otherwise clearing the field to type a new number reads as "0", gets
  // clamped straight back to the minimum, and the field becomes stuck
  // showing e.g. 0.001 before the cashier can type anything. Null means
  // "show the committed cart quantity".
  const [quantityInput, setQuantityInput] = useState<string | null>(null);

  // The cart context clamps to what's actually available too (last line of
  // defense), but that's a silent clamp — warn the cashier here so it's
  // clear why the number stopped moving instead of just refusing to go
  // higher. Not just currentStock — a plain/priced/amount-entry line for the
  // same product may already reserve some of it (see availableStock).
  function clampToStock(quantity: number): number {
    const available = cart.availableStock(line.product, line.lineId);
    if (quantity > available) {
      toast.error(`Only ${available} ${line.product.unit.abbreviation} of ${line.product.name} available.`);
      return available;
    }
    return quantity;
  }

  function setQuantity(quantity: number) {
    setAmountInput("");
    cart.setLineQuantity(line.lineId, clampToStock(quantity));
  }

  function stepQuantity(delta: number) {
    setQuantityInput(null);
    setQuantity(line.quantity + delta);
  }

  function handleQuantityInputChange(value: string) {
    setQuantityInput(value);
    const parsed = isFractional ? Number.parseFloat(value) : Number.parseInt(value, 10);
    // Leave the cart quantity alone while the field is empty or mid-edit
    // (e.g. "0.") instead of snapping it to the minimum on every keystroke.
    if (Number.isNaN(parsed)) return;
    setQuantity(parsed);
  }

  function handleQuantityInputBlur() {
    // Nothing committed (field left empty) — fall back to showing the last
    // committed cart quantity instead of leaving the field blank.
    setQuantityInput(null);
  }

  function handleAmountChange(value: string) {
    setAmountInput(value);
    if (line.product.activeSellingPrice <= 0) return;
    const amountCents = inputToCents(value);
    const quantity = Math.round((amountCents / line.product.activeSellingPrice) * 1000) / 1000;
    cart.setLineQuantity(line.lineId, clampToStock(quantity));
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b py-3 last:border-0">
      <div className="min-w-36 flex-1">
        <p className="truncate text-sm font-medium" title={line.product.name}>
          {line.product.name}
        </p>
        <p className="font-mono text-xs text-muted-foreground">{line.product.sku}</p>
        {totals.lineDiscount > 0 && (
          <p className="text-xs text-muted-foreground">−{formatMoney(totals.lineDiscount)} discount</p>
        )}
        {isPricedEntry ? (
          <p className="text-xs text-muted-foreground">
            {`Priced entry: ${line.quantity} ${line.product.unit.abbreviation} for ${formatMoney(line.lineTotalOverride!)}`}
          </p>
        ) : isAmountEntry ? (
          <p className="text-xs text-muted-foreground">
            {`Amount entry: ${formatMoney(line.lineTotalOverride!)} for ${line.quantity} ${line.product.unit.abbreviation}`}
          </p>
        ) : (
          line.unitPriceOverride != null && (
            <p className="text-xs text-muted-foreground">
              Price overridden to {formatMoney(line.unitPriceOverride)}
            </p>
          )
        )}
        {isFractional && !isPricedEntry && !isAmountEntry && (
          <div className="mt-1 flex items-center gap-1.5">
            <Label htmlFor={`amount-${line.lineId}`} className="shrink-0 text-xs text-muted-foreground">
              Amount:
            </Label>
            <Input
              id={`amount-${line.lineId}`}
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 100"
              value={amountInput}
              onChange={(e) => handleAmountChange(e.target.value)}
              className="h-7 w-24 shrink-0 text-xs"
            />
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {isPricedEntry || isAmountEntry ? (
          // A priced entry's quantity and total are set together (see
          // PricedEntryDialog), and an amount entry's are derived together
          // from the typed amount (see AmountCell) — steppering the
          // quantity alone would leave the fixed total stale.
          <span className="w-16 shrink-0 text-center text-sm">{line.quantity}</span>
        ) : (
          <>
            <Button variant="outline" size="icon-sm" onClick={() => stepQuantity(-step)}>
              <Minus className="size-3.5" />
            </Button>
            <Input
              type="number"
              min={isFractional ? "0.001" : "1"}
              step={isFractional ? "0.001" : "1"}
              value={quantityInput ?? line.quantity}
              onChange={(e) => handleQuantityInputChange(e.target.value)}
              onBlur={handleQuantityInputBlur}
              className="h-7 w-16 shrink-0 text-center"
            />
            <Button variant="outline" size="icon-sm" onClick={() => stepQuantity(step)}>
              <Plus className="size-3.5" />
            </Button>
          </>
        )}
      </div>
      <div className="w-20 shrink-0 text-right text-sm font-semibold">{formatMoney(totals.lineTotal)}</div>
      <div className="flex shrink-0 items-center gap-1">
        {isPricedEntry ? (
          <PricedEntryDialog
            product={line.product}
            line={line}
            trigger={
              <Button variant="ghost" size="icon-sm" title="Edit priced entry">
                <Tag className="size-3.5" />
              </Button>
            }
          />
        ) : isAmountEntry ? null : (
          // No edit dialog — retype the amount in Bulk Sale's Amount column
          // to change this line, same place it was added from.
          <LinePriceOverrideDialog line={line} />
        )}
        <LineDiscountDialog line={line} />
        <Button variant="ghost" size="icon-sm" onClick={() => cart.removeLine(line.lineId)}>
          <Trash2 className="size-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

interface Props {
  /** Forwarded to CheckoutDialog — see its own doc comment. */
  invoiceHref?: (saleId: string) => string;
}

export function CartPanel({ invoiceHref }: Props = {}) {
  const cart = useCart();
  const totals = useCartTotals();
  const queryClient = useQueryClient();

  const holdMutation = useMutation({
    mutationFn: () => saveDraft(cart.toCartLineInputs(), cart.draftId ?? undefined),
    onSuccess: () => {
      toast.success("Bill held.");
      queryClient.invalidateQueries({ queryKey: salesKeys.drafts() });
      cart.replace(null, []);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col">
      <div className="max-h-[50vh] overflow-y-auto lg:max-h-[calc(100vh-24rem)]">
        {cart.lines.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Cart is empty — tap a product to add it.
          </p>
        ) : (
          cart.lines.map((line) => <CartLineRow key={line.lineId} line={line} />)
        )}
      </div>

      <div className="flex flex-col gap-2 border-t pt-4">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatMoney(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Discount</span>
          <span>−{formatMoney(totals.discountTotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Tax</span>
          <span>{formatMoney(totals.taxTotal)}</span>
        </div>
        <div className="flex justify-between text-base font-semibold">
          <span>Total</span>
          <span>{formatMoney(totals.totalAmount)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <Button
            id="pos-hold-bill"
            variant="outline"
            disabled={cart.lines.length === 0 || holdMutation.isPending}
            onClick={() => holdMutation.mutate()}
          >
            Hold Bill (F3)
          </Button>
          <CheckoutDialog invoiceHref={invoiceHref} />
        </div>
      </div>
    </div>
  );
}
