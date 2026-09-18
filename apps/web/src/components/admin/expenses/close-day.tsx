"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  closeDay,
  dayClosingKeys,
  fetchDayClosingPreview,
  fetchDayClosings,
  type DayClosing,
} from "@/lib/day-closing";
import { centsToInput, formatMoney, inputToCents } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";

const PAGE_SIZE = 20;

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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function CloseDay() {
  const queryClient = useQueryClient();
  const currencySymbol = useCurrencySymbol();
  const [date, setDate] = useState("");
  const [cashUsedForInventory, setCashUsedForInventory] = useState("");
  const [note, setNote] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [loadedDate, setLoadedDate] = useState<string | null>(null);

  const resolvedDate = date || todayIsoDate();

  const { data: preview, isLoading } = useQuery({
    queryKey: dayClosingKeys.preview(date || undefined),
    queryFn: () => fetchDayClosingPreview(date || undefined),
    placeholderData: (prev) => prev,
  });

  // Prefill from an existing closing for this date so re-closing starts from
  // what was last recorded, instead of resetting to zero every render.
  // Adjusted during render (not an effect) so it applies before paint —
  // see https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  if (preview && preview.date === resolvedDate && preview.date !== loadedDate) {
    setLoadedDate(preview.date);
    setCashUsedForInventory(
      preview.closing ? centsToInput(preview.closing.cashUsedForInventory) : "",
    );
    setNote(preview.closing?.note ?? "");
  }

  const { data: history } = useQuery({
    queryKey: dayClosingKeys.list({ page: historyPage, pageSize: PAGE_SIZE }),
    queryFn: () => fetchDayClosings({ page: historyPage, pageSize: PAGE_SIZE }),
    placeholderData: (prev) => prev,
  });

  const mutation = useMutation({
    mutationFn: () =>
      closeDay({
        date: date || undefined,
        cashUsedForInventory: inputToCents(cashUsedForInventory),
        note: note || undefined,
      }),
    onSuccess: () => {
      toast.success(preview?.closing ? "Day closing updated." : "Day closed.");
      queryClient.invalidateQueries({ queryKey: dayClosingKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cents = inputToCents(cashUsedForInventory);
    if (cents < 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    mutation.mutate();
  }

  const cashSales = preview?.cashSales ?? 0;
  const cashRefunds = preview?.cashRefunds ?? 0;
  const cashWithdrawals = preview?.cashWithdrawals ?? 0;
  const cashDeposits = preview?.cashDeposits ?? 0;
  const cashFromSales = preview?.cashFromSales ?? 0;
  const expenses = preview?.expenses ?? 0;
  const cashUsedCents = inputToCents(cashUsedForInventory || "0");
  const cashRemainingFromSales = cashFromSales - cashUsedCents;
  const netCashInHand = cashRemainingFromSales - expenses;

  const historyItems = history?.items ?? [];
  const historyTotal = history?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(historyTotal / PAGE_SIZE));

  const columns: DataTableColumn<DayClosing>[] = [
    { header: "Date", cell: (c) => new Date(c.date).toLocaleDateString() },
    {
      header: "Total sales",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (c) => formatMoney(c.totalSales, currencySymbol),
    },
    {
      header: "Cash from sales",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (c) => formatMoney(c.cashFromSales, currencySymbol),
    },
    {
      header: "Withdrawals",
      headerClassName: "text-right",
      cellClassName: "text-right text-muted-foreground",
      cell: (c) => formatMoney(c.cashWithdrawals, currencySymbol),
    },
    {
      header: "Deposits",
      headerClassName: "text-right",
      cellClassName: "text-right text-muted-foreground",
      cell: (c) => formatMoney(c.cashDeposits, currencySymbol),
    },
    {
      header: "Spent on inventory",
      headerClassName: "text-right",
      cellClassName: "text-right text-muted-foreground",
      cell: (c) => formatMoney(c.cashUsedForInventory, currencySymbol),
    },
    {
      header: "Remaining from sales",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (c) => formatMoney(c.cashRemainingFromSales, currencySymbol),
    },
    {
      header: "Expenses",
      headerClassName: "text-right",
      cellClassName: "text-right text-muted-foreground",
      cell: (c) => formatMoney(c.expenses, currencySymbol),
    },
    {
      header: "Net cash in hand",
      headerClassName: "text-right",
      cellClassName: "text-right font-medium",
      cell: (c) => formatMoney(c.netCashInHand, currencySymbol),
    },
    { header: "Closed by", cell: (c) => c.closedBy.name },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <CardHeader className="px-0">
          <CardTitle className="text-base">
            {preview?.closing ? "Update day closing" : "Close the day"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="close-day-date">Date</Label>
                <Input
                  id="close-day-date"
                  type="date"
                  value={date}
                  max={todayIsoDate()}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="close-day-inventory">Cash spent on inventory purchases</Label>
                <Input
                  id="close-day-inventory"
                  type="number"
                  step="0.01"
                  min="0"
                  value={cashUsedForInventory}
                  onChange={(e) => setCashUsedForInventory(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>

            {!isLoading && preview && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Card className="p-5">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="text-sm">Cash Remaining from Sales</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 p-0">
                    <div className="border-b pb-2">
                      <Row label="Total sales (all payment methods)" value={preview.totalSales} currencySymbol={currencySymbol} />
                    </div>
                    {/* cashSales already includes cashDeposits — shown here
                        as "Cash sales" (product/bill-payment cash only)
                        plus a separate "Cash deposits" row, so these rows
                        sum exactly to cashFromSales instead of
                        double-counting deposits. */}
                    <Row label="Cash sales" value={cashSales - cashDeposits} currencySymbol={currencySymbol} />
                    <Row label="Cash deposits today" value={cashDeposits} currencySymbol={currencySymbol} />
                    <Row label="Cash refunds" value={-cashRefunds} currencySymbol={currencySymbol} />
                    <Row label="Cash withdrawals today" value={-cashWithdrawals} currencySymbol={currencySymbol} />
                    <div className="border-t pt-2">
                      <Row label="Cash from sales" value={cashFromSales} currencySymbol={currencySymbol} />
                    </div>
                    <Row label="Spent on inventory" value={-cashUsedCents} currencySymbol={currencySymbol} />
                    <div className="border-t pt-2">
                      <Row
                        label="Cash remaining from sales"
                        value={cashRemainingFromSales}
                        emphasis
                        currencySymbol={currencySymbol}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sales-driven cash before shop expenses — feeds net-profit-adjacent reporting.
                    </p>
                  </CardContent>
                </Card>
                <Card className="p-5">
                  <CardHeader className="px-0 pt-0">
                    <CardTitle className="text-sm">Net Cash in Hand</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2 p-0">
                    <Row
                      label="Cash remaining from sales"
                      value={cashRemainingFromSales}
                      currencySymbol={currencySymbol}
                    />
                    <Row label="Shop expenses today" value={-expenses} currencySymbol={currencySymbol} />
                    <div className="border-t pt-2">
                      <Row
                        label="Net cash in hand"
                        value={netCashInHand}
                        emphasis
                        currencySymbol={currencySymbol}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The actual physical cash left in the drawer at close.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="close-day-note">Note (optional)</Label>
              <Textarea
                id="close-day-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. bought vegetables from the wholesale market"
                rows={2}
              />
            </div>

            {preview?.closing && (
              <p className="text-sm text-muted-foreground">
                This day was already closed by {preview.closing.closedBy.name} on{" "}
                {new Date(preview.closing.closedAt).toLocaleString()}. Submitting again will overwrite it.
              </p>
            )}

            <div>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? "Saving…"
                  : preview?.closing
                    ? "Update closing"
                    : "Close day"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Closing history</h2>
        <DataTable
          columns={columns}
          rows={historyItems}
          isLoading={false}
          emptyMessage="No days closed yet."
          keyExtractor={(c) => c.id}
        />
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {historyPage} of {totalPages} ({historyTotal} closings)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={historyPage <= 1}
                onClick={() => setHistoryPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={historyPage >= totalPages}
                onClick={() => setHistoryPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
