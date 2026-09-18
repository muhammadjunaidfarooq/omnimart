"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { fetchDailySales, salesKeys } from "@/lib/sales";
import { useCurrencySymbol } from "@/lib/settings";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Whole-store totals for today, regardless of who's viewing — shown on the cashier Sales History page so a cashier can see how the day is going without an admin-only report. */
export function TodaysSalesSummary() {
  const currencySymbol = useCurrencySymbol();
  const today = todayIsoDate();
  const params = { from: today, to: today };

  const { data } = useQuery({
    queryKey: salesKeys.daily(params),
    queryFn: () => fetchDailySales(params),
  });

  const row = data?.[0];

  return (
    <Card className="p-4">
      <p className="text-sm font-medium text-muted-foreground">Today&apos;s Sales — Whole Store</p>
      <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <div>
          <p className="text-xs text-muted-foreground">Sales</p>
          <p className="text-lg font-semibold">{row?.count ?? 0}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cash</p>
          <p className="text-lg font-semibold">{formatMoney(row?.cash ?? 0, currencySymbol)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Transfer</p>
          <p className="text-lg font-semibold">{formatMoney(row?.transfer ?? 0, currencySymbol)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Khata (Credit)</p>
          <p className="text-lg font-semibold">{formatMoney(row?.credit ?? 0, currencySymbol)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-semibold">{formatMoney(row?.total ?? 0, currencySymbol)}</p>
        </div>
      </div>
    </Card>
  );
}
