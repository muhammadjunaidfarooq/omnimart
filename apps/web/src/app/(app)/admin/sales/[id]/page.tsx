import { notFound, redirect } from "next/navigation";
import { getCurrentUser, getSale, getSettings } from "@/lib/api";
import { InvoiceActions } from "@/components/sales/invoice-actions";
import { InvoiceCard } from "@/components/sales/invoice-card";
import { RefundDialog } from "@/components/sales/refund-dialog";

export default async function AdminSaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const [sale, settings] = await Promise.all([getSale(id), getSettings()]);

  if (!sale) {
    notFound();
  }

  if (sale.status !== "COMPLETED") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Bill not yet checked out</h1>
        <p className="text-muted-foreground">{sale.invoiceNumber} is still a held bill.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 print:max-w-none">
      <InvoiceActions backHref="/admin/sales" backLabel="Back to sales" />
      <InvoiceCard sale={sale} settings={settings} action={<RefundDialog sale={sale} />} />
    </div>
  );
}
