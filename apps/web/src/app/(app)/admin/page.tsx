import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { DashboardOverview } from "@/components/admin/dashboard/dashboard-overview";
import { ReportsSection } from "@/components/reports/reports-section";

export default async function AdminHomePage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="text-muted-foreground">Store overview, management tools, and reports.</p>
      </div>

      <DashboardOverview />

      <ReportsSection />
    </div>
  );
}
