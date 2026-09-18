"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import type { DashboardFilters } from "@/lib/dashboard";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/sales";
import { fetchUsers } from "@/lib/users";
import { KpiCards } from "./kpi-cards";
import { SalesTrendChart } from "./sales-trend-chart";
import { MonthlySalesChart } from "./monthly-sales-chart";
import { ProfitExpenseChart } from "./profit-expense-chart";
import { RecentSalesWidget } from "./recent-sales-widget";
import { TopProductsWidget } from "./top-products-widget";
import { LowStockWidget } from "./low-stock-widget";

const ALL_METHODS = "all";
const ALL_CASHIERS = "all";
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "TRANSFER", "CREDIT", "SPLIT"];

/**
 * Default dashboard window: the current calendar month to date (1st through
 * today) — the same "this month" every other totals view in the app uses by
 * default (Expenses summary, P&L, etc. — see currentMonthRange on the API
 * side), so the numbers agree no matter where they're checked. Every widget
 * shares this one default instead of falling back to its own.
 */
function defaultDashboardFrom(): string {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

function defaultDashboardTo(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardOverview() {
  const [from, setFrom] = useState(defaultDashboardFrom);
  const [to, setTo] = useState(defaultDashboardTo);
  const [paymentMethod, setPaymentMethod] = useState<string>(ALL_METHODS);
  const [cashierId, setCashierId] = useState<string>(ALL_CASHIERS);

  const { data: users } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });
  const cashiers = users?.filter((u) => u.role === "CASHIER") ?? [];

  const filters: DashboardFilters = {
    from: from || undefined,
    to: to || undefined,
    paymentMethod: paymentMethod === ALL_METHODS ? undefined : (paymentMethod as PaymentMethod),
    cashierId: cashierId === ALL_CASHIERS ? undefined : cashierId,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-3">
        <DateRangeFilter
          idPrefix="dashboard"
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          defaultLabel="Showing each widget's own default window."
        />
        <div className="flex flex-col gap-2">
          <Select value={paymentMethod} onValueChange={(v) => v && setPaymentMethod(v)}>
            <SelectTrigger className="w-44">
              <SelectValue>
                {(v: string) => (v === ALL_METHODS ? "All methods" : paymentMethodLabel(v as PaymentMethod))}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_METHODS}>All methods</SelectItem>
              {PAYMENT_METHODS.map((method) => (
                <SelectItem key={method} value={method}>
                  {paymentMethodLabel(method)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Combobox
            className="w-44"
            value={cashierId}
            onValueChange={(v) => setCashierId(v || ALL_CASHIERS)}
            searchPlaceholder="Search cashiers…"
            options={[
              { value: ALL_CASHIERS, label: "All cashiers" },
              ...cashiers.map((cashier) => ({ value: cashier.id, label: cashier.name })),
            ]}
          />
        </div>
      </div>

      <KpiCards filters={filters} />

      <div className="grid gap-4 lg:grid-cols-2">
        <SalesTrendChart filters={filters} />
        <MonthlySalesChart filters={filters} />
        <div className="lg:col-span-2">
          <ProfitExpenseChart filters={filters} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RecentSalesWidget filters={filters} />
        <TopProductsWidget filters={filters} />
        {/* Not date/filter-scoped — a live stock snapshot, unaffected by the filter bar above */}
        <LowStockWidget />
      </div>
    </div>
  );
}
