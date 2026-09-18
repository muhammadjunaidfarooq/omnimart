import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesDailyReport } from "./sales-daily-report";
import { SalesMonthlyReport } from "./sales-monthly-report";
import { SalesByProductReport } from "./sales-by-product-report";
import { InventoryStockReport } from "./inventory-stock-report";
import { FinancialPnlReport } from "./financial-pnl-report";
import { CashVsTransferReport } from "./cash-vs-transfer-report";
import { ExpenseSummaryReport } from "./expense-summary-report";

export function ReportsSection() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Reports</h2>
        <p className="text-sm text-muted-foreground">
          Filterable, exportable reports across sales, inventory, and finances.
        </p>
      </div>
      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="financial">Financial</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="flex flex-col gap-4 pt-4">
          <SalesDailyReport />
          <SalesMonthlyReport />
          <SalesByProductReport />
        </TabsContent>
        <TabsContent value="inventory" className="pt-4">
          <InventoryStockReport />
        </TabsContent>
        <TabsContent value="financial" className="flex flex-col gap-4 pt-4">
          <FinancialPnlReport />
          <CashVsTransferReport />
          <ExpenseSummaryReport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
