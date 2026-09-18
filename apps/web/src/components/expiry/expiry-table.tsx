"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { ExpiryBatch, ExpiryStatusFilter } from "@/lib/catalog";
import { formatDate } from "@/lib/date";
import { fetchExpiryOverview, inventoryKeys } from "@/lib/inventory";
import { useSortState } from "@/lib/use-sort";
import { ExpiryStatusBadge } from "./expiry-status-badge";
import { ExpiryTableSkeleton } from "./expiry-skeleton";

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<ExpiryStatusFilter, string> = {
  all: "All statuses",
  expired: "Expired",
  expiring_soon: "Expiring Soon",
  good: "Good",
};

const columns: DataTableColumn<ExpiryBatch>[] = [
  {
    header: "Product",
    sortKey: "product",
    cell: (b) => (
      <>
        <p className="font-medium">{b.product.name}</p>
        <p className="text-xs text-muted-foreground">{b.product.category.name}</p>
      </>
    ),
  },
  {
    header: "SKU",
    sortKey: "sku",
    cellClassName: "font-mono text-sm",
    cell: (b) => b.product.sku,
  },
  {
    header: "Remaining",
    sortKey: "remainingQuantity",
    headerClassName: "text-right",
    cellClassName: "text-right font-semibold",
    cell: (b) => (
      <>
        {b.remainingQuantity}{" "}
        <span className="text-xs font-normal text-muted-foreground">
          {b.product.unit.abbreviation}
        </span>
      </>
    ),
  },
  {
    header: "Expiry Date",
    sortKey: "expiryDate",
    cellClassName: "whitespace-nowrap",
    cell: (b) => formatDate(b.expiryDate!),
  },
  {
    header: "Status",
    cell: (b) => <ExpiryStatusBadge status={b.status} />,
  },
];

interface Props {
  initialData: PaginatedResponse<ExpiryBatch>;
}

export function ExpiryTable({ initialData }: Props) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ExpiryStatusFilter>("all");
  const { sortBy, sortOrder, handleSortChange } = useSortState("expiryDate");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: inventoryKeys.expiry({ page, search, status, sortBy, sortOrder }),
    queryFn: () => fetchExpiryOverview({ page, pageSize: PAGE_SIZE, search, status, sortBy, sortOrder }),
    initialData:
      page === 1 && !search && status === "all" && sortBy === "expiryDate" && sortOrder === "asc"
        ? initialData
        : undefined,
    placeholderData: (prev) => prev,
  });

  const batches = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function handleSort(key: string) {
    setPage(1);
    handleSortChange(key);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Search by product name or SKU…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as ExpiryStatusFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue>{(v: string) => STATUS_LABELS[v as ExpiryStatusFilter]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && !data ? (
        <ExpiryTableSkeleton />
      ) : (
        <div className={`transition-opacity ${isFetching ? "opacity-70" : ""}`}>
          <DataTable
            columns={columns}
            rows={batches}
            isLoading={false}
            emptyMessage="No batches with an expiry date found."
            keyExtractor={(b) => b.id}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSort}
          />
        </div>
      )}

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
