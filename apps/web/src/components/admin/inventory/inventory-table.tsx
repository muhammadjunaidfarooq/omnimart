"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ShoppingCart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PaginatedResponse } from "@/lib/api";
import type { Product, StockStatus } from "@/lib/catalog";
import { fetchInventory, inventoryKeys } from "@/lib/inventory";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { useSortState } from "@/lib/use-sort";
import { InventoryTableSkeleton } from "./inventory-skeleton";
import { StockInDialog } from "./stock-in-dialog";
import { AdjustmentDialog } from "./adjustment-dialog";
import { MovementHistoryDialog } from "./movement-history-dialog";
import { BatchListDialog } from "./batch-list-dialog";
import { InventoryBulkActions } from "./inventory-bulk-actions";
import { StockStatusBadge } from "./stock-status-badge";

const PAGE_SIZE = 20;

interface Props {
  initialData: PaginatedResponse<Product>;
}

export function InventoryTable({ initialData }: Props) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [stockStatus, setStockStatus] = useState<StockStatus>("all");
  const [excludeHiddenCategories, setExcludeHiddenCategories] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { sortBy, sortOrder, handleSortChange } = useSortState("name");
  const currencySymbol = useCurrencySymbol();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: inventoryKeys.list({ page, search, stockStatus, excludeHiddenCategories, sortBy, sortOrder }),
    queryFn: () =>
      fetchInventory({ page, pageSize: PAGE_SIZE, search, stockStatus, excludeHiddenCategories, sortBy, sortOrder }),
    initialData:
      page === 1 &&
      !search &&
      stockStatus === "all" &&
      !excludeHiddenCategories &&
      sortBy === "name" &&
      sortOrder === "asc"
        ? initialData
        : undefined,
    placeholderData: (prev) => prev,
  });

  const products = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Clear selection whenever the loaded page/filter results change, rather
  // than in an effect (avoids the extra cascading render) — the standard
  // "adjust state during render" pattern for resetting state on prop change.
  const [prevData, setPrevData] = useState(data);
  if (data !== prevData) {
    setPrevData(data);
    setSelectedIds(new Set());
  }

  function handleSort(key: string) {
    setPage(1);
    handleSortChange(key);
  }

  const columns: DataTableColumn<Product>[] = [
    {
      header: (
        <Checkbox
          checked={products.length > 0 && products.every((p) => selectedIds.has(p.id))}
          onChange={(e) => {
            setSelectedIds(e.target.checked ? new Set(products.map((p) => p.id)) : new Set());
          }}
          aria-label="Select all on this page"
        />
      ),
      headerClassName: "w-10",
      cell: (p) => (
        <Checkbox
          checked={selectedIds.has(p.id)}
          onChange={(e) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (e.target.checked) next.add(p.id);
              else next.delete(p.id);
              return next;
            });
          }}
          aria-label={`Select ${p.name}`}
        />
      ),
    },
    {
      header: "Product",
      sortKey: "name",
      cell: (p) => (
        <>
          <p className="font-medium">{p.name}</p>
          <p className="text-xs text-muted-foreground">{p.category.name}</p>
        </>
      ),
    },
    {
      header: "SKU",
      sortKey: "sku",
      cellClassName: "font-mono text-sm",
      cell: (p) => p.sku,
    },
    {
      header: "Stock",
      sortKey: "currentStock",
      headerClassName: "text-right",
      cellClassName: "text-right font-semibold",
      cell: (p) => (
        <>
          {p.currentStock}{" "}
          <span className="text-xs font-normal text-muted-foreground">{p.unit.abbreviation}</span>
        </>
      ),
    },
    {
      header: "Min. Level",
      sortKey: "minimumStockLevel",
      headerClassName: "text-right",
      cellClassName: "text-right text-muted-foreground",
      cell: (p) => p.minimumStockLevel,
    },
    {
      header: "Status",
      cell: (p) => <StockStatusBadge product={p} />,
    },
    {
      header: "Stock Value",
      headerClassName: "text-right",
      cellClassName: "text-right font-mono text-sm",
      cell: (p) => formatMoney(p.stockValue ?? 0, currencySymbol),
    },
    {
      header: "Actions",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <StockInDialog product={p} />
          <AdjustmentDialog product={p} />
          <BatchListDialog product={p} />
          <MovementHistoryDialog product={p} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search by name or SKU…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={stockStatus}
          onValueChange={(v) => {
            setStockStatus(v as StockStatus);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue>
              {(v: string) =>
                v === "all" ? "All statuses" : v === "low" ? "Low Stock" : "Out of Stock"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox
            checked={excludeHiddenCategories}
            onChange={(e) => {
              setExcludeHiddenCategories(e.target.checked);
              setPage(1);
            }}
          />
          Hide POS-hidden categories
        </label>
        <Button render={<Link href="/admin/inventory/bulk-sale" />} nativeButton={false}>
          <ShoppingCart className="size-4" />
          Add Bulk Sale
        </Button>
      </div>

      {selectedIds.size > 0 && (
        <InventoryBulkActions
          selectedIds={Array.from(selectedIds)}
          onDone={() => setSelectedIds(new Set())}
        />
      )}

      {/* Table */}
      {isLoading && !data ? (
        <InventoryTableSkeleton />
      ) : (
        <div className={`transition-opacity ${isFetching ? "opacity-70" : ""}`}>
          <DataTable
            columns={columns}
            rows={products}
            isLoading={false}
            emptyMessage="No products found."
            keyExtractor={(p) => p.id}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSort}
          />
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
