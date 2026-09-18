import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExpensesTable } from "@/components/admin/expenses/expenses-table";
import { PnlReport } from "@/components/admin/expenses/pnl-report";
import { DailyCashSummary } from "@/components/admin/expenses/daily-cash-summary";
import { CloseDay } from "@/components/admin/expenses/close-day";

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expenses &amp; Accounting</h1>
        <p className="text-muted-foreground">Track money-in/money-out and profitability.</p>
      </div>
      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="pnl">Profit &amp; Loss</TabsTrigger>
          <TabsTrigger value="cash">Daily Cash Summary</TabsTrigger>
          <TabsTrigger value="close-day">Close Day</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="pt-4">
          <ExpensesTable />
        </TabsContent>
        <TabsContent value="pnl" className="pt-4">
          <PnlReport />
        </TabsContent>
        <TabsContent value="cash" className="pt-4">
          <DailyCashSummary />
        </TabsContent>
        <TabsContent value="close-day" className="pt-4">
          <CloseDay />
        </TabsContent>
      </Tabs>
    </div>
  );
}
