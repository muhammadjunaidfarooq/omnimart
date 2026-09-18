"use client";

import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { accountingKeys, fetchMonthlyPnl } from "@/lib/accounting";
import type { DashboardFilters } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";

const tickStyle = { fontSize: 12, fill: "var(--color-muted-foreground)" };

function formatMonth(month: string) {
  return new Date(`${month}-01`).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function ProfitExpenseChart({ filters }: { filters: DashboardFilters }) {
  const { data } = useQuery({
    queryKey: accountingKeys.monthlyPnl(filters),
    queryFn: () => fetchMonthlyPnl(filters),
  });
  const currencySymbol = useCurrencySymbol();

  return (
    <Card className="p-4">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Profit vs Expense</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonth}
              tick={tickStyle}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
            />
            <YAxis
              tick={tickStyle}
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={(v: number) => formatMoney(v, currencySymbol)}
            />
            <Tooltip
              formatter={(value) => formatMoney(Number(value), currencySymbol)}
              labelFormatter={(m) => formatMonth(String(m))}
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="grossProfit" name="Profit" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={20} />
            <Bar dataKey="expenses" name="Expense" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
