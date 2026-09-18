"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchTopProducts, salesKeys } from "@/lib/sales";
import type { DashboardFilters } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";

export function TopProductsWidget({ filters }: { filters: DashboardFilters }) {
  const params = { ...filters, limit: 5 };
  const { data: products } = useQuery({
    queryKey: salesKeys.topProducts(params),
    queryFn: () => fetchTopProducts(params),
  });
  const currencySymbol = useCurrencySymbol();

  return (
    <Card className="p-4">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Top-Selling Products</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-0">
        {!products || products.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No sales yet.</p>
        ) : (
          products.map((product) => (
            <div key={product.productId} className="flex items-center justify-between text-sm">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{product.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatMoney(product.revenue, currencySymbol)}</p>
                <p className="text-xs text-muted-foreground">{product.quantitySold} sold</p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
