import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { BorrowerBills } from "@/components/khata/borrower-bills";

export default async function KhataBorrowerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  const { id } = await params;
  const saleBaseHref = user.role === "ADMIN" ? "/admin/sales" : "/cashier/sales";

  return <BorrowerBills borrowerId={id} saleBaseHref={saleBaseHref} isAdmin={user.role === "ADMIN"} />;
}
