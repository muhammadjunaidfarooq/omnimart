"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchDailySales, salesKeys, type DailySalesRow } from "@/lib/sales";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { DateRangeFilter } from "./date-range-filter";
import { ReportTable, type ReportColumn } from "./report-table";

export function SalesDailyReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const currencySymbol = useCurrencySymbol();

  const { data } = useQuery({
    queryKey: salesKeys.daily({ from: from || undefined, to: to || undefined }),
    queryFn: () => fetchDailySales({ from: from || undefined, to: to || undefined }),
  });

  const columns: ReportColumn<DailySalesRow>[] = [
    { header: "Date", cell: (r) => new Date(r.date).toLocaleDateString(), csvValue: (r) => r.date },
    { header: "Sales Count", cell: (r) => r.count, csvValue: (r) => r.count },
    { header: "Cash", cell: (r) => formatMoney(r.cash, currencySymbol), csvValue: (r) => r.cash / 100 },
    { header: "Transfer", cell: (r) => formatMoney(r.transfer, currencySymbol), csvValue: (r) => r.transfer / 100 },
    { header: "Khata (Credit)", cell: (r) => formatMoney(r.credit, currencySymbol), csvValue: (r) => r.credit / 100 },
    { header: "Total", cell: (r) => formatMoney(r.total, currencySymbol), csvValue: (r) => r.total / 100 },
  ];

  return (
    <ReportTable
      title="Daily Sales"
      filename="daily-sales-report"
      columns={columns}
      rows={data}
      keyExtractor={(r) => r.date}
      filters={
        <DateRangeFilter
          idPrefix="sales-daily"
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          defaultLabel="Showing the last 30 days."
        />
      }
    />
  );
}
