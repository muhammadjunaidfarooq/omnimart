"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EXPENSE_CATEGORY_LABELS, expensesKeys, fetchExpenseSummary, type ExpenseCategory } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { DateRangeFilter } from "./date-range-filter";
import { ReportTable, type ReportColumn } from "./report-table";

interface Row {
  category: ExpenseCategory;
  total: number;
}

export function ExpenseSummaryReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const currencySymbol = useCurrencySymbol();

  const { data } = useQuery({
    queryKey: expensesKeys.summary({ from: from || undefined, to: to || undefined }),
    queryFn: () => fetchExpenseSummary({ from: from || undefined, to: to || undefined }),
  });

  const columns: ReportColumn<Row>[] = [
    {
      header: "Category",
      cell: (r) => EXPENSE_CATEGORY_LABELS[r.category],
      csvValue: (r) => EXPENSE_CATEGORY_LABELS[r.category],
    },
    { header: "Total", cell: (r) => formatMoney(r.total, currencySymbol), csvValue: (r) => r.total / 100 },
  ];

  return (
    <ReportTable
      title="Expense Summary by Category"
      filename="expense-summary-report"
      columns={columns}
      rows={data?.byCategory}
      keyExtractor={(r) => r.category}
      filters={
        <DateRangeFilter
          idPrefix="expense-summary"
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          defaultLabel="Showing this month."
        />
      }
    />
  );
}
