"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Product, StockBatch } from "@/lib/catalog";
import { inventoryKeys, updateBatch } from "@/lib/inventory";
import { centsToInput, inputToCents } from "@/lib/money";

interface Props {
  product: Product;
  batch: StockBatch;
}

/** Corrects a batch that was entered wrong — every field here is the batch's new absolute value, unlike AdjustmentDialog's signed delta. */
export function EditBatchDialog({ product, batch }: Props) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(String(batch.quantity));
  const [remainingQuantity, setRemainingQuantity] = useState(String(batch.remainingQuantity));
  const [costPrice, setCostPrice] = useState(centsToInput(batch.costPrice));
  const [sellingPrice, setSellingPrice] = useState(centsToInput(batch.sellingPrice));
  const [expiryDate, setExpiryDate] = useState(batch.expiryDate ? batch.expiryDate.slice(0, 10) : "");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const isFractional = product.unit.allowsFractionalQuantity;

  const mutation = useMutation({
    mutationFn: (data: {
      quantity: number;
      remainingQuantity: number;
      costPrice: number;
      sellingPrice: number;
      expiryDate: string | null;
      reason: string;
    }) => updateBatch(product.id, batch.id, data),
    onSuccess: () => {
      toast.success("Stock batch corrected.");
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      setReason("");
      setOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newQuantity = isFractional ? Number.parseFloat(quantity) : Number.parseInt(quantity, 10);
    const newRemaining = isFractional
      ? Number.parseFloat(remainingQuantity)
      : Number.parseInt(remainingQuantity, 10);
    if (!Number.isFinite(newQuantity) || newQuantity < 0) {
      toast.error("Enter a valid received quantity.");
      return;
    }
    if (!Number.isFinite(newRemaining) || newRemaining < 0) {
      toast.error("Enter a valid remaining quantity.");
      return;
    }
    if (newRemaining > newQuantity) {
      toast.error("Remaining quantity can't exceed received quantity.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required when correcting a batch.");
      return;
    }
    mutation.mutate({
      quantity: newQuantity,
      remainingQuantity: newRemaining,
      costPrice: inputToCents(costPrice),
      sellingPrice: inputToCents(sellingPrice),
      expiryDate: expiryDate || null,
      reason,
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="icon" title="Correct Batch">
          <Pencil className="h-4 w-4" />
        </Button>
      }
      title={`Correct Stock Batch — ${product.name}`}
      footer={
        <Button form="edit-batch-form" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Save Correction"}
        </Button>
      }
    >
      <form id="edit-batch-form" onSubmit={handleSubmit} className="space-y-4 pt-2">
        <p className="text-sm text-muted-foreground">
          Use this when the batch itself was entered wrong — not for recording an ordinary
          stock movement (use Adjust Stock for that).
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="eb-qty">Received quantity</Label>
            <Input
              id="eb-qty"
              type="number"
              min="0"
              step={isFractional ? "0.001" : "1"}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eb-remaining">Remaining quantity</Label>
            <Input
              id="eb-remaining"
              type="number"
              min="0"
              step={isFractional ? "0.001" : "1"}
              value={remainingQuantity}
              onChange={(e) => setRemainingQuantity(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="eb-cost">Cost price</Label>
            <Input
              id="eb-cost"
              type="number"
              step="0.01"
              min="0"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="eb-selling">Selling price</Label>
            <Input
              id="eb-selling"
              type="number"
              step="0.01"
              min="0"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="eb-expiry">Expiry date</Label>
          <Input
            id="eb-expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Leave blank to clear it.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="eb-reason">Reason</Label>
          <Textarea
            id="eb-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Entered the wrong quantity when receiving stock"
            rows={2}
            required
          />
        </div>
      </form>
    </Modal>
  );
}
