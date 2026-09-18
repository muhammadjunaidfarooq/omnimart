"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Product } from "@/lib/catalog";
import { inventoryKeys, postStockIn } from "@/lib/inventory";
import { centsToInput, formatMoney, inputToCents } from "@/lib/money";

interface Props {
  product: Product;
}

export function StockInDialog({ product }: Props) {
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
      reason?: string;
      expiryDate?: string;
      costPrice?: number;
      sellingPrice?: number;
    }) => postStockIn(product.id, data),
    onSuccess: () => {
      toast.success(`Added ${qty} units to ${product.name}.`);
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
    const quantity = isFractional ? Number.parseFloat(qty) : Number.parseInt(qty, 10);
    const minQuantity = isFractional ? 0.001 : 1;
    if (!Number.isFinite(quantity) || quantity < minQuantity) {
      toast.error(`Enter a valid quantity (≥ ${minQuantity}).`);
      return;
    }
    mutation.mutate({
      quantity,
      reason: reason || undefined,
      expiryDate: expiryDate || undefined,
      costPrice: costPrice ? inputToCents(costPrice) : undefined,
      sellingPrice: sellingPrice ? inputToCents(sellingPrice) : undefined,
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="icon" title="Stock In">
          <PackagePlus className="h-4 w-4" />
        </Button>
      }
      title={`Stock In — ${product.name}`}
      footer={
        <Button form="stock-in-form" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Confirm Stock In"}
        </Button>
      }
    >
      <form id="stock-in-form" onSubmit={handleSubmit} className="space-y-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Current stock:{" "}
          <span className="font-medium">
            {product.currentStock} {product.unit.abbreviation}
          </span>
        </p>
        <div className="space-y-2">
          <Label htmlFor="si-qty">Quantity to add</Label>
          <Input
            id="si-qty"
            type="number"
            min={isFractional ? "0.001" : "1"}
            step={isFractional ? "0.001" : "1"}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder={isFractional ? "e.g. 0.5" : "e.g. 50"}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="si-expiry">Expiry date (optional)</Label>
          <Input
            id="si-expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            This stock is tracked as its own batch — leave blank if it doesn&apos;t expire.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="si-cost">Cost price (optional)</Label>
            <Input
              id="si-cost"
              type="number"
              step="0.01"
              min="0"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder={centsToInput(product.costPrice)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="si-selling">Selling price (optional)</Label>
            <Input
              id="si-selling"
              type="number"
              step="0.01"
              min="0"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder={centsToInput(product.sellingPrice)}
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          This batch keeps selling at this price until depleted, even if the product&apos;s price
          changes later. Leave blank to use the current price ({formatMoney(product.sellingPrice)}).
        </p>
        <div className="space-y-2">
          <Label htmlFor="si-reason">Reason (optional)</Label>
          <Textarea
            id="si-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Supplier delivery"
            rows={2}
          />
        </div>
      </form>
    </Modal>
  );
}
