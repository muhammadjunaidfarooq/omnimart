import { redirect } from "next/navigation";
import { getAllInventory, getCurrentUser, getSettings } from "@/lib/api";
import type { StockStatus } from "@/lib/catalog";
import { InvoiceActions } from "@/components/sales/invoice-actions";
import { InventoryStockPrintCard } from "@/components/reports/inventory-stock-print-card";

function parseStockStatus(value?: string): StockStatus {
  return value === "low" || value === "out" ? value : "all";
}

export default async function InventoryStockPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ stockStatus?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { stockStatus: rawStatus } = await searchParams;
  const stockStatus = parseStockStatus(rawStatus);
  const [products, settings] = await Promise.all([
    getAllInventory({ stockStatus }),
    getSettings(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 print:max-w-none">
      <InvoiceActions backHref="/admin" backLabel="Back to dashboard" />
      <InventoryStockPrintCard products={products} stockStatus={stockStatus} settings={settings} />
    </div>
  );
}
