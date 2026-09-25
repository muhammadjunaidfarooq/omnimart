"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ExpiryStatusBadge } from "@/components/expiry/expiry-status-badge";
import type { Product, StockBatch } from "@/lib/catalog";
import { formatDate, formatDateTime } from "@/lib/date";
import { fetchBatches, inventoryKeys } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { useSortedRows } from "@/lib/use-sort";
import { EditBatchDialog } from "./edit-batch-dialog";

interface Props {
  product: Product;
}

const SORT_ACCESSORS: Record<string, (b: StockBatch) => string | number | null> = {
  quantity: (b) => b.quantity,
  remainingQuantity: (b) => b.remainingQuantity,
  costPrice: (b) => b.costPrice,
  sellingPrice: (b) => b.sellingPrice,
  expiryDate: (b) => b.expiryDate,
  createdBy: (b) => b.createdBy.name,
  createdAt: (b) => b.createdAt,
};

export function BatchListDialog({ product }: Props) {
  const currencySymbol = useCurrencySymbol();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: inventoryKeys.batches(product.id),
    queryFn: () => fetchBatches(product.id),
    enabled: open,
  });

  const columns: DataTableColumn<StockBatch>[] = [
    {
      header: "Received",
      sortKey: "quantity",
      headerClassName: "text-right",
      cellClassName: "text-right font-mono",
      cell: (b) => b.quantity,
    },
    {
      header: "Remaining",
      sortKey: "remainingQuantity",
      headerClassName: "text-right",
      cellClassName: "text-right font-mono font-semibold",
      cell: (b) => b.remainingQuantity,
    },
    {
      header: "Cost",
      sortKey: "costPrice",
      headerClassName: "text-right",
      cellClassName: "text-right font-mono text-sm",
      cell: (b) => formatMoney(b.costPrice, currencySymbol),
    },
    {
      header: "Selling Price",
      sortKey: "sellingPrice",
      headerClassName: "text-right",
      cellClassName: "text-right font-mono text-sm",
      cell: (b) => formatMoney(b.sellingPrice, currencySymbol),
    },
    {
      header: "Expiry Date",
      sortKey: "expiryDate",
      cell: (b) => (b.expiryDate ? formatDate(b.expiryDate) : "—"),
    },
    {
      header: "Status",
      cell: (b) => <ExpiryStatusBadge status={b.status} />,
    },
    {
      header: "Reason",
      cell: (b) => <span className="text-muted-foreground">{b.reason ?? "—"}</span>,
    },
    {
      header: "Received By",
      sortKey: "createdBy",
      cell: (b) => b.createdBy.name,
    },
    {
      header: "Date",
      sortKey: "createdAt",
      cellClassName: "whitespace-nowrap text-sm text-muted-foreground",
      cell: (b) => formatDateTime(b.createdAt),
    },
    {
      header: "",
      headerClassName: "w-10",
      cellClassName: "text-right",
      cell: (b) => <EditBatchDialog product={product} batch={b} />,
    },
  ];

  const { sortedRows: batches, sortBy, sortOrder, handleSortChange } = useSortedRows(
    data,
    SORT_ACCESSORS,
    "expiryDate",
  );

  return (
    <Modal
      open={open}
      onOpenChange={setOpen}
      trigger={
        <Button variant="ghost" size="icon" title="Stock Batches">
          <Layers className="h-4 w-4" />
        </Button>
      }
      title={`Stock Batches — ${product.name}`}
      size="xl"
    >
      <p className="pb-3 text-sm text-muted-foreground">
        Batches still in stock only — see Movement History for the full ledger, including
        depleted batches.
      </p>
      <DataTable
        columns={columns}
        rows={batches}
        isLoading={isLoading}
        emptyMessage="No stock in any batch right now."
        keyExtractor={(b) => b.id}
        skeletonRows={5}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />
    </Modal>
  );
}
