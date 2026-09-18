import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServicesManager } from "@/components/admin/services/services-manager";
import { ServiceTransactionsTable } from "@/components/services/service-transactions-table";

export default function ServicesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <p className="text-muted-foreground">
          Manage bill-payment services and review transactions recorded at the POS.
        </p>
      </div>
      <Tabs defaultValue="services">
        <TabsList>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>
        <TabsContent value="services" className="pt-4">
          <ServicesManager />
        </TabsContent>
        <TabsContent value="transactions" className="pt-4">
          <ServiceTransactionsTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
