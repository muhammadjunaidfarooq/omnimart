import { redirect } from "next/navigation";
import { getCurrentUser, getPriceListProducts, getSettings } from "@/lib/api";
import { InvoiceActions } from "@/components/sales/invoice-actions";
import { PriceListCard } from "@/components/admin/price-list-card";

export default async function PriceListPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [products, settings] = await Promise.all([getPriceListProducts(), getSettings()]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 print:max-w-none">
      <InvoiceActions backHref="/admin/catalog" backLabel="Back to catalog" />
      <PriceListCard products={products} settings={settings} />
    </div>
  );
}
