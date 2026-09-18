"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  dashboardKeys,
  fetchRecentSales,
  fetchRecentServiceTransactions,
  type DashboardFilters,
} from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/sales";
import { useCurrencySymbol } from "@/lib/settings";

type View = "sales" | "services";

export function RecentSalesWidget({ filters }: { filters: DashboardFilters }) {
  const [view, setView] = useState<View>("sales");
  const currencySymbol = useCurrencySymbol();

  const { data: sales } = useQuery({
    queryKey: dashboardKeys.recentSales(filters),
    queryFn: () => fetchRecentSales(filters),
    enabled: view === "sales",
  });
  const { data: serviceTransactions } = useQuery({
    queryKey: dashboardKeys.recentServiceTransactions(filters),
    queryFn: () => fetchRecentServiceTransactions(filters),
    enabled: view === "services",
  });

  return (
    <Card className="p-4">
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-0">
        <CardTitle className="text-base">
          {view === "sales" ? "Recent Sales" : "Recent Service Transactions"}
        </CardTitle>
        <div className="flex gap-1 rounded-lg border p-0.5">
          <Button
            type="button"
            size="sm"
            variant={view === "sales" ? "default" : "ghost"}
            className="h-7 px-2.5"
            onClick={() => setView("sales")}
          >
            Sales
          </Button>
          <Button
            type="button"
            size="sm"
            variant={view === "services" ? "default" : "ghost"}
            className="h-7 px-2.5"
            onClick={() => setView("services")}
          >
            Services
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-0">
        {view === "sales" ? (
          !sales || sales.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No sales yet.</p>
          ) : (
            sales.map((sale) => (
              <Link
                key={sale.id}
                href={`/admin/sales/${sale.id}`}
                className="flex items-center justify-between rounded-md px-1 py-1 text-sm hover:bg-muted"
              >
                <div>
                  <p className="font-mono text-xs">{sale.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">{sale.cashier.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{paymentMethodLabel(sale.paymentMethod)}</Badge>
                  <span className="font-medium">{formatMoney(sale.totalAmount, currencySymbol)}</span>
                </div>
              </Link>
            ))
          )
        ) : !serviceTransactions || serviceTransactions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No service transactions yet.</p>
        ) : (
          serviceTransactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center justify-between rounded-md px-1 py-1 text-sm"
            >
              <div>
                <p className="font-mono text-xs">{transaction.transactionNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {transaction.service.name} · {transaction.cashier.name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{paymentMethodLabel(transaction.paymentMethod)}</Badge>
                <span className="font-medium">{formatMoney(transaction.totalAmount, currencySymbol)}</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
