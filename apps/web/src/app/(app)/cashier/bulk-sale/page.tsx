import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { BulkSaleWorkspace } from "@/components/sales/bulk-sale-workspace";

export default async function CashierBulkSalePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CASHIER") {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Bulk Sale</h1>
        <p className="text-muted-foreground">
          Set a quantity for each product below, then check out the same way as at the register.
        </p>
      </div>
      <BulkSaleWorkspace invoiceBasePath="/cashier/sales" />
    </div>
  );
}
