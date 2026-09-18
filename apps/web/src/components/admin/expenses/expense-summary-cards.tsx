"use client";

import { EXPENSE_CATEGORY_LABELS, type ExpenseSummary } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";

export function ExpenseSummaryCards({ summary, filtered }: { summary: ExpenseSummary; filtered: boolean }) {
  const topCategories = [...summary.byCategory].sort((a, b) => b.total - a.total).slice(0, 3);
  const currencySymbol = useCurrencySymbol();

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total {filtered ? "(filtered)" : "(this month)"}</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(summary.total, currencySymbol)}</p>
        </div>
        {topCategories.map((c) => (
          <div key={c.category} className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{EXPENSE_CATEGORY_LABELS[c.category]}</p>
            <p className="mt-1 text-2xl font-semibold">{formatMoney(c.total, currencySymbol)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
