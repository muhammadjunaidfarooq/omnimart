import type { InventorySummary } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";

interface Props {
  summary: InventorySummary;
  currencySymbol: string;
}

export function InventorySummaryCards({ summary, currencySymbol }: Props) {
  const cards = [
    {
      label: "Out of Stock",
      value: String(summary.outOfStockCount),
      className: "border-destructive/30 bg-destructive/5",
    },
    {
      label: "Low Stock",
      value: String(summary.lowStockCount),
      className:
        "border-amber-300/50 bg-amber-50 dark:border-amber-700/30 dark:bg-amber-900/10",
    },
    {
      label: "Total Stock Value",
      value: formatMoney(summary.totalStockValue, currencySymbol),
      className: "",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((c) => (
        <div key={c.label} className={`rounded-lg border p-4 ${c.className}`}>
          <p className="text-sm text-muted-foreground">{c.label}</p>
          <p className="mt-1 text-2xl font-semibold">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
