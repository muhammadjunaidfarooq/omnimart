"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { fetchBorrowers, khataKeys, type Borrower } from "@/lib/khata";
import { formatMoney } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { useSortedRows } from "@/lib/use-sort";

const SORT_ACCESSORS: Record<string, (b: Borrower) => string | number | null> = {
  name: (b) => b.name,
  phone: (b) => b.phone,
  unpaidBillCount: (b) => b.unpaidBillCount,
  totalDue: (b) => b.totalDue,
  creditBalance: (b) => b.creditBalance,
};

export function BorrowersTable() {
  const [search, setSearch] = useState("");
  const currencySymbol = useCurrencySymbol();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: khataKeys.borrowers(search || undefined),
    queryFn: () => fetchBorrowers(search || undefined),
    placeholderData: (prev) => prev,
  });

  const { sortedRows: borrowers, sortBy, sortOrder, handleSortChange } = useSortedRows(
    data,
    SORT_ACCESSORS,
    "name",
  );

  const columns: DataTableColumn<Borrower>[] = [
    { header: "Name", sortKey: "name", cell: (b) => <span className="font-medium">{b.name}</span> },
    { header: "Phone", sortKey: "phone", cell: (b) => b.phone ?? "—" },
    {
      header: "Unpaid bills",
      sortKey: "unpaidBillCount",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (b) =>
        b.unpaidBillCount > 0 ? (
          <Badge variant={b.totalDue > 0 ? "destructive" : "secondary"}>{b.unpaidBillCount}</Badge>
        ) : (
          <Badge variant="secondary">0</Badge>
        ),
    },
    {
      header: "Amount due",
      sortKey: "totalDue",
      headerClassName: "text-right",
      cellClassName: "text-right font-medium",
      cell: (b) => formatMoney(b.totalDue, currencySymbol),
    },
    {
      header: "Credit",
      sortKey: "creditBalance",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (b) => (b.creditBalance > 0 ? formatMoney(b.creditBalance, currencySymbol) : "—"),
    },
    {
      header: "",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (b) => (
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href={`/khata/${b.id}`} />}
          nativeButton={false}
          aria-label={`View ${b.name}'s bills`}
        >
          <Eye className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:w-72">
        <Label htmlFor="borrower-search">Search borrowers</Label>
        <Input
          id="borrower-search"
          placeholder="Name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading && !data ? (
        <DataTable
          columns={columns}
          rows={undefined}
          isLoading
          emptyMessage="No borrowers found."
          keyExtractor={(b) => b.id}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
        />
      ) : (
        <div className={`transition-opacity ${isFetching ? "opacity-70" : ""}`}>
          <DataTable
            columns={columns}
            rows={borrowers}
            isLoading={false}
            emptyMessage="No borrowers found."
            keyExtractor={(b) => b.id}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
          />
        </div>
      )}
    </div>
  );
}
