"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { createRefund, salesKeys, type RefundItemInput, type Sale } from "@/lib/sales";

export function RefundDialog({ sale }: { sale: Sale }) {
  const currencySymbol = useCurrencySymbol();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const refundableItems = sale.items.filter((item) => (item.refundableQuantity ?? 0) > 0);

  function handleOpenChange(next: boolean) {
    if (next) {
      setReason("");
      setQuantities({});
    }
    setOpen(next);
  }

  const mutation = useMutation({
    mutationFn: (items: RefundItemInput[]) => createRefund(sale.id, items, reason || undefined),
    onSuccess: (refund) => {
      toast.success(`Refunded ${formatMoney(refund.totalAmount, currencySymbol)}.`);
      queryClient.invalidateQueries({ queryKey: salesKeys.all });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const items: RefundItemInput[] = [];
    for (const item of refundableItems) {
      const quantity = Number.parseInt(quantities[item.id] ?? "", 10);
      if (!quantity || quantity <= 0) continue;
      const max = item.refundableQuantity ?? 0;
      if (quantity > max) {
        toast.error(`Cannot refund more than ${max} of "${item.productName}".`);
        return;
      }
      items.push({ saleItemId: item.id, quantity });
    }
    if (items.length === 0) {
      toast.error("Enter a quantity to refund for at least one item.");
      return;
    }
    mutation.mutate(items);
  }

  if (refundableItems.length === 0) return null;

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button variant="outline">
          <Undo2 className="size-4" />
          Issue refund
        </Button>
      }
      title={`Refund — ${sale.invoiceNumber}`}
      description="Select the quantity to return for each item. Stock is added back automatically."
      footer={
        <Button form="refund-form" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Processing…" : "Confirm refund"}
        </Button>
      }
    >
      <form id="refund-form" onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-3">
          {refundableItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.refundableQuantity} of {item.quantity} refundable ·{" "}
                  {formatMoney(item.unitPrice, currencySymbol)} each
                </p>
              </div>
              <Input
                type="number"
                min="0"
                max={item.refundableQuantity}
                placeholder="0"
                className="w-20 text-right"
                value={quantities[item.id] ?? ""}
                onChange={(e) =>
                  setQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="refund-reason">Reason (optional)</Label>
          <Textarea
            id="refund-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer returned damaged item"
            rows={2}
          />
        </div>
      </form>
    </Modal>
  );
}
