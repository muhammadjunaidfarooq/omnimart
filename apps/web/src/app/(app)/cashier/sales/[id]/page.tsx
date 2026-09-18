import { notFound } from "next/navigation";
import { getSale, getSettings } from "@/lib/api";
import { InvoiceActions } from "@/components/sales/invoice-actions";
import { InvoiceCard } from "@/components/sales/invoice-card";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [sale, settings] = await Promise.all([getSale(id), getSettings()]);

  if (!sale) {
    notFound();
  }

  if (sale.status !== "COMPLETED") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Bill not yet checked out</h1>
        <p className="text-muted-foreground">
          {sale.invoiceNumber} is still a held bill. Resume it from the POS screen to complete the
          sale.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 print:max-w-none">
      <InvoiceActions backHref="/cashier" backLabel="New sale" />
      <InvoiceCard sale={sale} settings={settings} />
    </div>
  );
}
