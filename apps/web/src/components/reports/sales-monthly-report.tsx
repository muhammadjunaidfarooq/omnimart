"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMonthlySales, salesKeys, type MonthlySalesRow } from "@/lib/sales";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { DateRangeFilter } from "./date-range-filter";
import { ReportTable, type ReportColumn } from "./report-table";

function formatMonth(month: string) {
  return new Date(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function SalesMonthlyReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const currencySymbol = useCurrencySymbol();

  const { data } = useQuery({
    queryKey: salesKeys.monthly({ from: from || undefined, to: to || undefined }),
    queryFn: () => fetchMonthlySales({ from: from || undefined, to: to || undefined }),
  });

  const columns: ReportColumn<MonthlySalesRow>[] = [
    { header: "Month", cell: (r) => formatMonth(r.month), csvValue: (r) => r.month },
    { header: "Sales Count", cell: (r) => r.count, csvValue: (r) => r.count },
    { header: "Cash", cell: (r) => formatMoney(r.cash, currencySymbol), csvValue: (r) => r.cash / 100 },
    { header: "Transfer", cell: (r) => formatMoney(r.transfer, currencySymbol), csvValue: (r) => r.transfer / 100 },
    { header: "Khata (Credit)", cell: (r) => formatMoney(r.credit, currencySymbol), csvValue: (r) => r.credit / 100 },
    { header: "Total", cell: (r) => formatMoney(r.total, currencySymbol), csvValue: (r) => r.total / 100 },
  ];

  return (
    <ReportTable
      title="Monthly Sales"
      filename="monthly-sales-report"
      columns={columns}
      rows={data}
      keyExtractor={(r) => r.month}
      filters={
        <DateRangeFilter
          idPrefix="sales-monthly"
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          defaultLabel="Showing the last 12 months."
        />
      }
    />
  );
}
