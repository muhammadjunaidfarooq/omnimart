import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { SalesHistoryTable } from "@/components/sales/sales-history-table";

export default async function AdminSalesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales</h1>
        <p className="text-muted-foreground">All completed sales across the store.</p>
      </div>
      <SalesHistoryTable baseHref="/admin/sales" />
    </div>
  );
}
