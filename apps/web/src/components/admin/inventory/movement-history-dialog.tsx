"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { Product, StockMovement } from "@/lib/catalog";
import { fetchMovements, inventoryKeys } from "@/lib/inventory";
import { useSortedRows } from "@/lib/use-sort";

interface Props {
  product: Product;
}

const SORT_ACCESSORS: Record<string, (m: StockMovement) => string | number | null> = {
  type: (m) => m.type,
  quantity: (m) => m.quantity,
  user: (m) => m.user.name,
  createdAt: (m) => m.createdAt,
};

function MovementTypeBadge({ type }: { type: StockMovement["type"] }) {
  if (type === "IN")
    return (
      <Badge
        variant="secondary"
        className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      >
        IN
      </Badge>
    );
  if (type === "OUT") return <Badge variant="destructive">OUT</Badge>;
  return <Badge variant="secondary">ADJ</Badge>;
}

const columns: DataTableColumn<StockMovement>[] = [
  {
    header: "Type",
    sortKey: "type",
    cell: (m) => <MovementTypeBadge type={m.type} />,
  },
  {
    header: "Qty",
    sortKey: "quantity",
    headerClassName: "text-right",
    cellClassName: "text-right font-mono",
    cell: (m) => (m.quantity > 0 ? `+${m.quantity}` : m.quantity),
  },
  {
    header: "Reason",
    cell: (m) => <span className="text-muted-foreground">{m.reason ?? "—"}</span>,
  },
  {
    header: "By",
    sortKey: "user",
    cell: (m) => m.user.name,
  },
  {
    header: "Date",
    sortKey: "createdAt",
    cellClassName: "whitespace-nowrap text-sm text-muted-foreground",
    cell: (m) => new Date(m.createdAt).toLocaleString(),
  },
];

export function MovementHistoryDialog({ product }: Props) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.movements(product.id),
    queryFn: () => fetchMovements(product.id),
    enabled: open,
  });

  const { sortedRows: movements, sortBy, sortOrder, handleSortChange } = useSortedRows(
    data?.items,
    SORT_ACCESSORS,
    "createdAt",
    "desc",
  );

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="icon" title="Movement History">
          <History className="h-4 w-4" />
        </Button>
      }
      title={`Movement History — ${product.name}`}
      size="xl"
    >
      <DataTable
        columns={columns}
        rows={movements}
        isLoading={isLoading}
        emptyMessage="No movements recorded yet."
        keyExtractor={(m) => m.id}
        skeletonRows={5}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />
    </Modal>
  );
}
