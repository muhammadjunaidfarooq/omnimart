"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchInventory, inventoryKeys } from "@/lib/inventory";

export function LowStockWidget() {
  const { data } = useQuery({
    queryKey: inventoryKeys.list({ page: 1, search: "", stockStatus: "low" }),
    queryFn: () => fetchInventory({ page: 1, pageSize: 5, search: "", stockStatus: "low" }),
  });

  const products = data?.items ?? [];

  return (
    <Card className="p-4">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Low Stock Alerts</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-0">
        {!data || products.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nothing low on stock.</p>
        ) : (
          products.map((product) => (
            <Link
              key={product.id}
              href="/admin/inventory"
              className="flex items-center justify-between rounded-md px-1 py-1 text-sm hover:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{product.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{product.sku}</p>
              </div>
              <Badge
                variant="secondary"
                className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              >
                {product.currentStock} / {product.minimumStockLevel} {product.unit.abbreviation}
              </Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}
