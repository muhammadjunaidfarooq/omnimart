import { Suspense } from "react";
import { getInventory, getInventorySummary, getSettings } from "@/lib/api";
import { InventorySummaryCards } from "@/components/admin/inventory/inventory-summary";
import { InventoryTable } from "@/components/admin/inventory/inventory-table";
import {
  InventorySummarySkeleton,
  InventoryTableSkeleton,
} from "@/components/admin/inventory/inventory-skeleton";

async function SummarySection() {
  const [summary, settings] = await Promise.all([getInventorySummary(), getSettings()]);
  return <InventorySummaryCards summary={summary} currencySymbol={settings.currencySymbol} />;
}

async function TableSection() {
  const initialData = await getInventory({ page: 1, pageSize: 20 });
  return <InventoryTable initialData={initialData} />;
}

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="text-muted-foreground">Track stock levels and record movements.</p>
      </div>
      <Suspense fallback={<InventorySummarySkeleton />}>
        <SummarySection />
      </Suspense>
      <Suspense fallback={<InventoryTableSkeleton />}>
        <TableSection />
      </Suspense>
    </div>
  );
}
