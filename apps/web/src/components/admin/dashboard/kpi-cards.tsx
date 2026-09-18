"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, XCircle } from "lucide-react";
import { dashboardKeys, fetchKpis, type DashboardFilters } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { Skeleton } from "@/components/ui/skeleton";

interface Tile {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export function KpiCards({ filters }: { filters: DashboardFilters }) {
  const { data: kpis } = useQuery({
    queryKey: dashboardKeys.kpis(filters),
    queryFn: () => fetchKpis(filters),
  });
  const currencySymbol = useCurrencySymbol();

  if (!kpis) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 13 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  const tiles: Tile[] = [
    { label: "Sale", value: formatMoney(kpis.salesTotal, currencySymbol) },
    { label: "Refunds", value: formatMoney(kpis.refundsTotal, currencySymbol) },
    { label: "Net Sale", value: formatMoney(kpis.netSales, currencySymbol) },
    { label: "Service Revenue", value: formatMoney(kpis.serviceRevenue, currencySymbol) },
    { label: "Gross Profit", value: formatMoney(kpis.grossProfit, currencySymbol) },
    { label: "Expenses", value: formatMoney(kpis.expenses, currencySymbol) },
    { label: "Net Profit", value: formatMoney(kpis.netProfit, currencySymbol) },
    { label: "Cash in Hand", value: formatMoney(kpis.cashInHand, currencySymbol) },
    { label: "Net Cash in Hand", value: formatMoney(kpis.netCashInHand, currencySymbol) },
    { label: "Online Transfer", value: formatMoney(kpis.onlineTransferTotal, currencySymbol) },
    { label: "Inventory Value", value: formatMoney(kpis.inventoryValue, currencySymbol) },
    {
      label: "Low Stock",
      value: String(kpis.lowStockCount),
      icon: kpis.lowStockCount > 0 && (
        <AlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
      ),
    },
    {
      label: "Out of Stock",
      value: String(kpis.outOfStockCount),
      icon: kpis.outOfStockCount > 0 && <XCircle className="size-3.5 text-destructive" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-lg border p-4">
          <div className="flex items-center gap-1.5">
            {tile.icon}
            <p className="text-sm text-muted-foreground">{tile.label}</p>
          </div>
          <p className="mt-1 text-2xl font-semibold">{tile.value}</p>
        </div>
      ))}
    </div>
  );
}
