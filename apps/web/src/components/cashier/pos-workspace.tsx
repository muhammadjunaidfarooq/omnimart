"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CartProvider } from "./cart-context";
import { CartPanel } from "./cart-panel";
import { ProductGrid } from "./product-grid";
import { HeldBillsSheet } from "./held-bills-sheet";
import { ServiceTransactionDialog } from "./service-transaction-dialog";
import { usePosShortcuts } from "./use-pos-shortcuts";

function PosShortcutsListener() {
  usePosShortcuts();
  return null;
}

export function PosWorkspace() {
  return (
    <CartProvider>
      <PosShortcutsListener />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Point of Sale</h1>
              <p className="text-sm text-muted-foreground">
                Search for a product to add it to the cart.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" render={<Link href="/cashier/bulk-sale" />} nativeButton={false}>
                <ShoppingCart className="size-4" />
                Add Bulk Sale
              </Button>
              <ServiceTransactionDialog />
              <HeldBillsSheet />
            </div>
          </div>
          <Card className="p-4">
            <ProductGrid />
          </Card>
        </div>
        <Card className="flex w-full flex-col p-4 lg:w-[380px] lg:shrink-0">
          <CartPanel />
        </Card>
      </div>
      <p className="pt-3 text-center text-xs text-muted-foreground">
        F1 search · F3 hold bill · F4 checkout · F5 cash · F6 transfer
      </p>
    </CartProvider>
  );
}
