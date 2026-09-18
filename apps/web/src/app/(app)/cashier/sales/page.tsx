import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesHistoryTable } from "@/components/sales/sales-history-table";
import { TodaysSalesSummary } from "@/components/sales/todays-sales-summary";
import { ServiceTransactionsTable } from "@/components/services/service-transactions-table";

export default async function CashierSalesHistoryPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CASHIER") {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sales History</h1>
        <p className="text-muted-foreground">Your past sales and service transactions.</p>
      </div>
      <TodaysSalesSummary />
      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="pt-4">
          <SalesHistoryTable baseHref="/cashier/sales" />
        </TabsContent>
        <TabsContent value="services" className="pt-4">
          <ServiceTransactionsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
