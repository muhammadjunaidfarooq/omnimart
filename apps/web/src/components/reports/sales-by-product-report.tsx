"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTopProducts, salesKeys, type TopProduct } from "@/lib/sales";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { DateRangeFilter } from "./date-range-filter";
import { ReportTable, type ReportColumn } from "./report-table";

export function SalesByProductReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const currencySymbol = useCurrencySymbol();

  const { data } = useQuery({
    queryKey: salesKeys.topProducts({ from: from || undefined, to: to || undefined }),
    queryFn: () => fetchTopProducts({ from: from || undefined, to: to || undefined }),
  });

  const columns: ReportColumn<TopProduct>[] = [
    { header: "Product", cell: (r) => r.name, csvValue: (r) => r.name },
    { header: "SKU", cell: (r) => r.sku, csvValue: (r) => r.sku },
    { header: "Qty Sold", cell: (r) => r.quantitySold, csvValue: (r) => r.quantitySold },
    { header: "Revenue", cell: (r) => formatMoney(r.revenue, currencySymbol), csvValue: (r) => r.revenue / 100 },
  ];

  return (
    <ReportTable
      title="Sales by Product"
      filename="sales-by-product-report"
      columns={columns}
      rows={data}
      keyExtractor={(r) => r.productId}
      filters={
        <DateRangeFilter
          idPrefix="sales-by-product"
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          defaultLabel="Showing all-time totals."
        />
      }
    />
  );
}
