"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ClipboardList, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { fetchProduct } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { deleteDraft, fetchDrafts, fetchSale, salesKeys, type Sale } from "@/lib/sales";
import { useCart, type CartLine } from "./cart-context";

async function hydrateDraft(sale: Sale): Promise<CartLine[]> {
  const products = await Promise.all(sale.items.map((item) => fetchProduct(item.productId)));
  // unitPriceOverride/lineTotalOverride are cashier overrides for one sale
  // only — never persisted on SaleItem, so (as before) they can't be
  // restored when a held bill is resumed; each item just gets a fresh
  // lineId so duplicate-product lines still round-trip correctly.
  return sale.items.map((item, i) => ({
    lineId: crypto.randomUUID(),
    product: products[i],
    quantity: item.quantity,
    discountType: item.discountType ?? undefined,
    discountValue: item.discountValue ?? undefined,
  }));
}

export function HeldBillsSheet() {
  const cart = useCart();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: drafts } = useQuery({
    queryKey: salesKeys.drafts(),
    queryFn: fetchDrafts,
  });

  const resumeMutation = useMutation({
    mutationFn: async (draftId: string) => {
      const sale = await fetchSale(draftId);
      const lines = await hydrateDraft(sale);
      return { draftId, lines };
    },
    onSuccess: ({ draftId, lines }) => {
      cart.replace(draftId, lines);
      setOpen(false);
    },
    onError: () => toast.error("Could not resume this bill."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDraft(id),
    onSuccess: () => {
      toast.success("Held bill deleted.");
      queryClient.invalidateQueries({ queryKey: salesKeys.drafts() });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleResume(draftId: string) {
    if (cart.lines.length > 0) return; // guarded by AlertDialog confirm below
    resumeMutation.mutate(draftId);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline">
            <ClipboardList className="size-4" />
            Held Bills {drafts && drafts.length > 0 ? `(${drafts.length})` : ""}
          </Button>
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Held Bills</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4">
          {!drafts || drafts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No held bills.</p>
          ) : (
            drafts.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{sale.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {sale.items.length} item{sale.items.length === 1 ? "" : "s"} ·{" "}
                    {formatMoney(sale.totalAmount)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {cart.lines.length > 0 ? (
                    <AlertDialog>
                      <AlertDialogTrigger render={<Button size="sm">Resume</Button>} />
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Replace current cart?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Your current cart has items that haven&apos;t been held or checked out.
                            Resuming this bill will discard them.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => resumeMutation.mutate(sale.id)}>
                            Resume anyway
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button size="sm" onClick={() => handleResume(sale.id)}>
                      Resume
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="Delete held bill">
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      }
                    />
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {sale.invoiceNumber}?</AlertDialogTitle>
                        <AlertDialogDescription>This can&apos;t be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-white hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate(sale.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
