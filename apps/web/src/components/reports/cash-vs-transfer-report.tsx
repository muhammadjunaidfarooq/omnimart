"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { accountingKeys, fetchCashVsTransferDaily, type CashVsTransferRow } from "@/lib/accounting";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { DateRangeFilter } from "./date-range-filter";
import { ReportTable, type ReportColumn } from "./report-table";

export function CashVsTransferReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const currencySymbol = useCurrencySymbol();

  const { data } = useQuery({
    queryKey: accountingKeys.cashVsTransfer({ from: from || undefined, to: to || undefined }),
    queryFn: () => fetchCashVsTransferDaily({ from: from || undefined, to: to || undefined }),
  });

  const columns: ReportColumn<CashVsTransferRow>[] = [
    { header: "Date", cell: (r) => new Date(r.date).toLocaleDateString(), csvValue: (r) => r.date },
    { header: "Cash Sales", cell: (r) => formatMoney(r.cashSales, currencySymbol), csvValue: (r) => r.cashSales / 100 },
    {
      header: "Cash Refunds",
      cell: (r) => formatMoney(r.cashRefunds, currencySymbol),
      csvValue: (r) => r.cashRefunds / 100,
    },
    { header: "Net Cash", cell: (r) => formatMoney(r.netCash, currencySymbol), csvValue: (r) => r.netCash / 100 },
    {
      header: "Transfer Sales",
      cell: (r) => formatMoney(r.transferSales, currencySymbol),
      csvValue: (r) => r.transferSales / 100,
    },
    {
      header: "Transfer Refunds",
      cell: (r) => formatMoney(r.transferRefunds, currencySymbol),
      csvValue: (r) => r.transferRefunds / 100,
    },
    {
      header: "Net Transfer",
      cell: (r) => formatMoney(r.netTransfer, currencySymbol),
      csvValue: (r) => r.netTransfer / 100,
    },
  ];

  return (
    <ReportTable
      title="Cash vs Online Transfer"
      filename="cash-vs-transfer-report"
      columns={columns}
      rows={data}
      keyExtractor={(r) => r.date}
      filters={
        <DateRangeFilter
          idPrefix="cash-vs-transfer"
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
