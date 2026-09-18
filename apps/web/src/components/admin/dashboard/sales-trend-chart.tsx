"use client";

import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchDailySales, salesKeys } from "@/lib/sales";
import type { DashboardFilters } from "@/lib/dashboard";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";

const tickStyle = { fontSize: 12, fill: "var(--color-muted-foreground)" };

export function SalesTrendChart({ filters }: { filters: DashboardFilters }) {
  const { data } = useQuery({
    queryKey: salesKeys.daily(filters),
    queryFn: () => fetchDailySales(filters),
  });
  const currencySymbol = useCurrencySymbol();

  return (
    <Card className="p-4">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Daily Sales Trend</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data ?? []} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) =>
                new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
              }
              tick={tickStyle}
              axisLine={{ stroke: "var(--color-border)" }}
              tickLine={false}
              minTickGap={24}
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
              labelFormatter={(d) => new Date(String(d)).toLocaleDateString()}
              contentStyle={{
                background: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Sales"
              stroke="var(--color-chart-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-card)" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
