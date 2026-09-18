"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAllInventory, inventoryKeys } from "@/lib/inventory";
import type { Product, StockStatus } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { ReportTable, type ReportColumn } from "./report-table";

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  all: "Stock Summary (All Products)",
  low: "Low Stock",
  out: "Out of Stock",
};

export function InventoryStockReport() {
  const [stockStatus, setStockStatus] = useState<StockStatus>("all");
  const currencySymbol = useCurrencySymbol();

  const { data } = useQuery({
    queryKey: inventoryKeys.report({ search: "", stockStatus }),
    queryFn: () => fetchAllInventory({ search: "", stockStatus }),
  });

  const columns: ReportColumn<Product>[] = [
    { header: "Product", cell: (p) => p.name, csvValue: (p) => p.name },
    { header: "SKU", cell: (p) => p.sku, csvValue: (p) => p.sku },
    { header: "Category", cell: (p) => p.category.name, csvValue: (p) => p.category.name },
    {
      header: "Current Stock",
      cell: (p) => `${p.currentStock} ${p.unit.abbreviation}`,
      csvValue: (p) => p.currentStock,
    },
    { header: "Min Level", cell: (p) => p.minimumStockLevel, csvValue: (p) => p.minimumStockLevel },
    {
      header: "Stock Value",
      cell: (p) => formatMoney(p.stockValue ?? 0, currencySymbol),
      csvValue: (p) => (p.stockValue ?? 0) / 100,
    },
  ];

  return (
    <ReportTable
      title={STOCK_STATUS_LABELS[stockStatus]}
      filename={`inventory-${stockStatus}-report`}
      pdfHref={`/admin/reports/inventory-stock/print?stockStatus=${stockStatus}`}
      columns={columns}
      rows={data}
      keyExtractor={(p) => p.id}
      filters={
        <div className="flex flex-col gap-2">
          <Label htmlFor="inventory-report-status">Report</Label>
          <Select value={stockStatus} onValueChange={(v) => v && setStockStatus(v as StockStatus)}>
            <SelectTrigger id="inventory-report-status" className="w-56">
              <SelectValue>{(v: string) => STOCK_STATUS_LABELS[v as StockStatus]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Stock Summary (All Products)</SelectItem>
              <SelectItem value="low">Low Stock</SelectItem>
              <SelectItem value="out">Out of Stock</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    />
  );
}
