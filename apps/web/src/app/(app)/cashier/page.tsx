import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { PosWorkspace } from "@/components/cashier/pos-workspace";

export default async function CashierHomePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CASHIER") {
    redirect("/login");
  }

  return <PosWorkspace />;
}
