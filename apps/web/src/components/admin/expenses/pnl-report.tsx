"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { accountingKeys, fetchPnl } from "@/lib/accounting";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/expenses";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";

function Row({
  label,
  value,
  emphasis,
  indent,
  currencySymbol,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  indent?: boolean;
  currencySymbol: string;
}) {
  return (
    <div
      className={`flex justify-between ${indent ? "pl-4 text-sm text-muted-foreground" : ""} ${
        emphasis ? "text-base font-semibold" : "text-sm"
      }`}
    >
      <span>{label}</span>
      <span className={value < 0 ? "text-destructive" : undefined}>{formatMoney(value, currencySymbol)}</span>
    </div>
  );
}

export function PnlReport() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const currencySymbol = useCurrencySymbol();

  const { data } = useQuery({
    queryKey: accountingKeys.pnl({ from: from || undefined, to: to || undefined }),
    queryFn: () => fetchPnl({ from: from || undefined, to: to || undefined }),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pnl-from">From</Label>
          <Input id="pnl-from" type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pnl-to">To</Label>
          <Input id="pnl-to" type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {!from && !to && <p className="pb-1.5 text-sm text-muted-foreground">Showing this month.</p>}
      </div>

      {data && (
        <Card className="max-w-xl p-6">
          <CardHeader className="px-0">
            <CardTitle className="text-base">Profit &amp; Loss</CardTitle>
            <CardDescription>
              {new Date(data.from!).toLocaleDateString()} – {new Date(data.to!).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-0">
            <div className="flex flex-col gap-1">
              <Row label="Sales — Cash" value={data.sales.cash} indent currencySymbol={currencySymbol} />
              <Row label="Sales — Online Transfer" value={data.sales.transfer} indent currencySymbol={currencySymbol} />
              <Row label="Sales — Khata (Credit)" value={data.sales.credit} indent currencySymbol={currencySymbol} />
              <Row label="Total Sales" value={data.sales.total} currencySymbol={currencySymbol} />
            </div>

            <div className="flex flex-col gap-1 border-t pt-3">
              <Row label="Refunds — Cash" value={-data.refunds.cash} indent currencySymbol={currencySymbol} />
              <Row label="Refunds — Online Transfer" value={-data.refunds.transfer} indent currencySymbol={currencySymbol} />
              <Row label="Refunds — Khata (Credit)" value={-data.refunds.credit} indent currencySymbol={currencySymbol} />
              <Row label="Total Refunds" value={-data.refunds.total} currencySymbol={currencySymbol} />
            </div>

            <Row label="Net Revenue" value={data.netRevenue} emphasis currencySymbol={currencySymbol} />

            <div className="flex flex-col gap-1 border-t pt-3">
              <Row label="Cost of Goods Sold" value={-data.cogs} currencySymbol={currencySymbol} />
              <Row label="Gross Profit" value={data.grossProfit} emphasis currencySymbol={currencySymbol} />
            </div>

            <div className="flex flex-col gap-1 border-t pt-3">
              {data.expenses.byCategory.map((c) => (
                <Row
                  key={c.category}
                  label={EXPENSE_CATEGORY_LABELS[c.category]}
                  value={-c.total}
                  indent
                  currencySymbol={currencySymbol}
                />
              ))}
              <Row label="Total Expenses" value={-data.expenses.total} currencySymbol={currencySymbol} />
            </div>

            <div className="border-t pt-3">
              <Row label="Net Profit" value={data.netProfit} emphasis currencySymbol={currencySymbol} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
