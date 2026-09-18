"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gauge, PackagePlus, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import {
  type BulkSkipped,
  inventoryKeys,
  postBulkAdjust,
  postBulkMinimumStock,
  postBulkStockIn,
} from "@/lib/inventory";
import { inputToCents } from "@/lib/money";

interface Props {
  selectedIds: string[];
  onDone: () => void;
}

function summarize(action: string, succeeded: number, skipped: BulkSkipped[]) {
  if (skipped.length === 0) return `${action} ${succeeded} product(s).`;
  return `${action} ${succeeded} product(s). ${skipped.length} skipped: ${skipped
    .map((s) => `${s.name} (${s.reason})`)
    .join(", ")}`;
}

export function InventoryBulkActions({ selectedIds, onDone }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>
      <div className="ml-auto flex flex-wrap gap-2">
        <BulkMinimumStockDialog ids={selectedIds} onDone={onDone} />
        <BulkStockInDialog ids={selectedIds} onDone={onDone} />
        <BulkAdjustDialog ids={selectedIds} onDone={onDone} />
      </div>
    </div>
  );
}

function BulkMinimumStockDialog({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (minimumStockLevel: number) => postBulkMinimumStock(ids, minimumStockLevel),
    onSuccess: (data) => {
      toast.success(`Updated minimum stock level for ${data.updated} product(s).`);
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      setValue("");
      setOpen(false);
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast.error("Enter a valid minimum stock level.");
      return;
    }
    mutation.mutate(parsed);
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline" size="sm">
          <Gauge className="size-4" />
          Min. Stock Level
        </Button>
      }
      title="Set Minimum Stock Level"
      description={`Applies the same reorder threshold to ${ids.length} selected product(s).`}
      footer={
        <Button form="bulk-min-stock-form" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Applying…" : "Apply"}
        </Button>
      }
    >
      <form id="bulk-min-stock-form" onSubmit={handleSubmit} className="flex flex-col gap-2 py-2">
        <Label htmlFor="bulk-min-stock">Minimum stock level</Label>
        <Input
          id="bulk-min-stock"
          type="number"
          min="0"
          step="0.001"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. 10"
          required
        />
      </form>
    </Modal>
  );
}

function BulkStockInDialog({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      postBulkStockIn({
        ids,
        quantity: Number.parseFloat(qty),
        reason: reason || undefined,
        expiryDate: expiryDate || undefined,
        costPrice: costPrice ? inputToCents(costPrice) : undefined,
        sellingPrice: sellingPrice ? inputToCents(sellingPrice) : undefined,
      }),
    onSuccess: (data) => {
      toast.success(summarize("Stocked in", data.succeeded, data.skipped));
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      setQty("");
      setReason("");
      setExpiryDate("");
      setCostPrice("");
      setSellingPrice("");
      setOpen(false);
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = Number.parseFloat(qty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast.error("Enter a valid quantity.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline" size="sm">
          <PackagePlus className="size-4" />
          Stock In
        </Button>
      }
      title="Bulk Stock In"
      description={`Receives the same quantity into a new batch for each of ${ids.length} selected product(s). A product whose unit doesn't allow this quantity (e.g. a fraction on a whole-number-only unit) is skipped.`}
      footer={
        <Button form="bulk-stock-in-form" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Confirm Stock In"}
        </Button>
      }
    >
      <form id="bulk-stock-in-form" onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-stock-in-qty">Quantity to add (each)</Label>
          <Input
            id="bulk-stock-in-qty"
            type="number"
            min="0.001"
            step="0.001"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="e.g. 50"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-stock-in-expiry">Expiry date (optional)</Label>
          <Input
            id="bulk-stock-in-expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Each product gets its own new batch — leave blank if it doesn&apos;t expire.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bulk-stock-in-cost">Cost price (optional)</Label>
            <Input
              id="bulk-stock-in-cost"
              type="number"
              step="0.01"
              min="0"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              placeholder="Use each product's own"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bulk-stock-in-selling">Selling price (optional)</Label>
            <Input
              id="bulk-stock-in-selling"
              type="number"
              step="0.01"
              min="0"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="Use each product's own"
            />
          </div>
        </div>
        <p className="-mt-2 text-xs text-muted-foreground">
          Each new batch keeps selling at this price until depleted, even if the product&apos;s
          price changes later. Leave blank to use each product&apos;s own current price.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-stock-in-reason">Reason (optional)</Label>
          <Textarea
            id="bulk-stock-in-reason"
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

function BulkAdjustDialog({ ids, onDone }: { ids: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () =>
      postBulkAdjust({
        ids,
        quantity: Number.parseFloat(qty),
        reason,
      }),
    onSuccess: (data) => {
      toast.success(summarize("Adjusted", data.succeeded, data.skipped));
      queryClient.invalidateQueries({ queryKey: inventoryKeys.all });
      setQty("");
      setReason("");
      setOpen(false);
      onDone();
    },
    onError: (err) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const quantity = Number.parseFloat(qty);
    if (!Number.isFinite(quantity) || quantity === 0) {
      toast.error("Enter a non-zero quantity.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason is required for adjustments.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="outline" size="sm">
          <ArrowUpDown className="size-4" />
          Adjust Stock
        </Button>
      }
      title="Bulk Adjust Stock"
      description={`Applies the same signed adjustment to each of ${ids.length} selected product(s) — e.g. a stocktake correction affecting many items alike. A product this can't apply to (not enough stock to remove, or a fractional delta on a whole-number-only unit) is skipped.`}
      footer={
        <Button form="bulk-adjust-form" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Confirm Adjustment"}
        </Button>
      }
    >
      <form id="bulk-adjust-form" onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-adjust-qty">Adjustment quantity (each)</Label>
          <Input
            id="bulk-adjust-qty"
            type="number"
            step="0.001"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="e.g. -5 to remove, +10 to add"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-adjust-reason">Reason</Label>
          <Textarea
            id="bulk-adjust-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Stocktake correction"
            rows={2}
            required
          />
        </div>
      </form>
    </Modal>
  );
}
