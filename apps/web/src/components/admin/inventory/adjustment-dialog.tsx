"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Product } from "@/lib/catalog";
import { inventoryKeys, postAdjustment } from "@/lib/inventory";
import { centsToInput, formatMoney, inputToCents } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";

interface Props {
  product: Product;
}

export function AdjustmentDialog({ product }: Props) {
  const currencySymbol = useCurrencySymbol();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const queryClient = useQueryClient();
  const isFractional = product.unit.allowsFractionalQuantity;

  const mutation = useMutation({
    mutationFn: (data: {
      quantity: number;
      reason: string;
      expiryDate?: string;
      costPrice?: number;
      sellingPrice?: number;
    }) => postAdjustment(product.id, data),
    onSuccess: () => {
      toast.success(`Stock adjusted for ${product.name}.`);
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      setQty("");
      setReason("");
      setExpiryDate("");
      setCostPrice("");
      setSellingPrice("");
      setOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantity =
      qty.trim() === ""
        ? 0
        : isFractional
          ? Number.parseFloat(qty)
          : Number.parseInt(qty, 10);
    if (Number.isNaN(quantity)) {
      toast.error("Enter a valid quantity.");
      return;
    }
    if (quantity === 0 && !costPrice && !sellingPrice) {
      toast.error("Enter a non-zero quantity, or a corrected cost/selling price.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required for adjustments.");
      return;
    }
    mutation.mutate({
      quantity,
      reason,
      expiryDate: quantity > 0 ? expiryDate || undefined : undefined,
      costPrice: quantity >= 0 && costPrice ? inputToCents(costPrice) : undefined,
      sellingPrice: quantity >= 0 && sellingPrice ? inputToCents(sellingPrice) : undefined,
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="icon" title="Adjust Stock">
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      }
      title={`Adjust Stock — ${product.name}`}
      footer={
        <Button form="adj-form" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Confirm Adjustment"}
        </Button>
      }
    >
      <form id="adj-form" onSubmit={handleSubmit} className="space-y-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Current stock:{" "}
          <span className="font-medium">
            {product.currentStock} {product.unit.abbreviation}
          </span>
        </p>
        <div className="space-y-2">
          <Label htmlFor="adj-qty">Adjustment quantity</Label>
          <Input
            id="adj-qty"
            type="number"
            step={isFractional ? "0.001" : "1"}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={isFractional ? "e.g. -0.5 to remove, 1.5 to add" : "e.g. -5 to remove, +10 to add"}
          />
          <p className="text-xs text-muted-foreground">
            Positive to increase, negative to decrease. Leave at 0 to correct the cost/selling
            price below without changing stock.
          </p>
        </div>
        {Number(qty) > 0 && (
          <div className="space-y-2">
            <Label htmlFor="adj-expiry">Expiry date (optional)</Label>
            <Input
              id="adj-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This addition is tracked as its own batch — leave blank if it doesn&apos;t expire.
            </p>
          </div>
        )}
        {Number(qty) >= 0 && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="adj-cost">Cost price (optional)</Label>
                <Input
                  id="adj-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder={centsToInput(product.costPrice)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adj-selling">Selling price (optional)</Label>
                <Input
                  id="adj-selling"
                  type="number"
                  step="0.01"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  placeholder={centsToInput(product.sellingPrice)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {Number(qty) > 0
                ? "This batch keeps selling at this price until depleted. Leave blank to use the current price " +
                  `(${formatMoney(product.sellingPrice, currencySymbol)}).`
                : "With quantity at 0, this corrects the product's recorded price directly — use this when the price was entered wrong, not the stock count."}
            </p>
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="adj-reason">Reason</Label>
          <Textarea
            id="adj-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Damaged goods, stocktake correction"
            rows={2}
            required
          />
        </div>
      </form>
    </Modal>
  );
}
