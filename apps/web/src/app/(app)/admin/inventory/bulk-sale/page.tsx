import { BulkSaleWorkspace } from "@/components/sales/bulk-sale-workspace";

export default function BulkSalePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Bulk Sale</h1>
        <p className="text-muted-foreground">
          Set a quantity for each product below, then check out the same way as at the register.
        </p>
      </div>
      <BulkSaleWorkspace />
    </div>
  );
}
