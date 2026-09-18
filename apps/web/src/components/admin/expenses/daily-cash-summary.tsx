"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { accountingKeys, fetchDailyCashSummary } from "@/lib/accounting";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";

function Row({
  label,
  value,
  emphasis,
  currencySymbol,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
  currencySymbol: string;
}) {
  return (
    <div className={`flex justify-between ${emphasis ? "text-base font-semibold" : "text-sm text-muted-foreground"}`}>
      <span>{label}</span>
      <span className={value < 0 ? "text-destructive" : undefined}>{formatMoney(value, currencySymbol)}</span>
    </div>
  );
}

export function DailyCashSummary() {
  const [date, setDate] = useState("");
  const currencySymbol = useCurrencySymbol();

  const { data } = useQuery({
    queryKey: accountingKeys.dailyCashSummary(date || undefined),
    queryFn: () => fetchDailyCashSummary(date || undefined),
    placeholderData: (prev) => prev,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cash-summary-date">Date</Label>
          <Input
            id="cash-summary-date"
            type="date"
            className="w-40"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {!date && <p className="pb-1.5 text-sm text-muted-foreground">Showing today.</p>}
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <CardHeader className="px-0">
              <CardTitle className="text-base">Cash</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-0">
              {/* cashSales already includes Cash Deposit intake — shown here
                  as "Sales" (product/bill-payment cash only, excluding
                  deposits) plus a separate "Deposits" row, so these rows sum
                  exactly to Net cash in hand instead of double-counting. */}
              <Row label="Sales" value={data.cashSales - data.cashDeposits} currencySymbol={currencySymbol} />
              <Row label="Deposits" value={data.cashDeposits} currencySymbol={currencySymbol} />
              <Row label="Refunds" value={-data.cashRefunds} currencySymbol={currencySymbol} />
              <Row label="Withdrawals" value={-data.cashWithdrawals} currencySymbol={currencySymbol} />
              <Row label="Expenses" value={-data.expenses} currencySymbol={currencySymbol} />
              <div className="border-t pt-2">
                <Row label="Net cash in hand" value={data.netCash} emphasis currencySymbol={currencySymbol} />
              </div>
            </CardContent>
          </Card>

          <Card className="p-5">
            <CardHeader className="px-0">
              <CardTitle className="text-base">Online Transfer</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 px-0">
              <Row label="Sales" value={data.transferSales} currencySymbol={currencySymbol} />
              <Row label="Refunds" value={-data.transferRefunds} currencySymbol={currencySymbol} />
              <div className="border-t pt-2">
                <Row label="Net transfer total" value={data.netTransfer} emphasis currencySymbol={currencySymbol} />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
