"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { accountingKeys, fetchMonthlyPnl, type MonthlyPnlRow } from "@/lib/accounting";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { DateRangeFilter } from "./date-range-filter";
import { ReportTable, type ReportColumn } from "./report-table";

function formatMonth(month: string) {
  return new Date(`${month}-01`).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export function FinancialPnlReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const currencySymbol = useCurrencySymbol();

  const { data } = useQuery({
    queryKey: accountingKeys.monthlyPnl({ from: from || undefined, to: to || undefined }),
    queryFn: () => fetchMonthlyPnl({ from: from || undefined, to: to || undefined }),
  });

  const columns: ReportColumn<MonthlyPnlRow>[] = [
    { header: "Month", cell: (r) => formatMonth(r.month), csvValue: (r) => r.month },
    { header: "Revenue", cell: (r) => formatMoney(r.revenue, currencySymbol), csvValue: (r) => r.revenue / 100 },
    { header: "Refunds", cell: (r) => formatMoney(r.refunds, currencySymbol), csvValue: (r) => r.refunds / 100 },
    {
      header: "Net Revenue",
      cell: (r) => formatMoney(r.netRevenue, currencySymbol),
      csvValue: (r) => r.netRevenue / 100,
    },
    { header: "COGS", cell: (r) => formatMoney(r.cogs, currencySymbol), csvValue: (r) => r.cogs / 100 },
    {
      header: "Service Revenue",
      cell: (r) => formatMoney(r.serviceRevenue, currencySymbol),
      csvValue: (r) => r.serviceRevenue / 100,
    },
    {
      header: "Gross Profit",
      cell: (r) => formatMoney(r.grossProfit, currencySymbol),
      csvValue: (r) => r.grossProfit / 100,
    },
    { header: "Expenses", cell: (r) => formatMoney(r.expenses, currencySymbol), csvValue: (r) => r.expenses / 100 },
    {
      header: "Net Profit",
      cell: (r) => formatMoney(r.netProfit, currencySymbol),
      csvValue: (r) => r.netProfit / 100,
    },
  ];

  return (
    <ReportTable
      title="Profit & Loss (Monthly)"
      filename="pnl-report"
      columns={columns}
      rows={data}
      keyExtractor={(r) => r.month}
      filters={
        <DateRangeFilter
          idPrefix="financial-pnl"
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
