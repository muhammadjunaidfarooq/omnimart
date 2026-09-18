"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { API_URL, type Product } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { fetchSalesHistory, paymentMethodLabel, salesKeys, type Sale } from "@/lib/sales";
import { useSortState } from "@/lib/use-sort";

const PAGE_SIZE = 20;
const ALL_PRODUCTS = "all";

async function fetchAllProducts(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/products?pageSize=100`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch products");
  const data = await res.json();
  return data.items;
}

function RefundBadge({ sale }: { sale: Sale }) {
  const refunded = sale.refundedAmount ?? 0;
  if (refunded === 0) return null;
  const fullyRefunded = refunded >= sale.totalAmount;
  return (
    <Badge variant={fullyRefunded ? "destructive" : "secondary"}>
      {fullyRefunded ? "Refunded" : "Partially refunded"}
    </Badge>
  );
}

export function SalesHistoryTable({ baseHref }: { baseHref: string }) {
  const [page, setPage] = useState(1);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [productId, setProductId] = useState(ALL_PRODUCTS);
  const { sortBy, sortOrder, handleSortChange } = useSortState("completedAt", "desc");

  const { data: products } = useQuery({ queryKey: ["all-products"], queryFn: fetchAllProducts });

  const params = {
    page,
    pageSize: PAGE_SIZE,
    invoiceNumber: invoiceNumber || undefined,
    from: from || undefined,
    to: to || undefined,
    productId: productId === ALL_PRODUCTS ? undefined : productId,
    sortBy,
    sortOrder,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: salesKeys.history(params),
    queryFn: () => fetchSalesHistory(params),
    placeholderData: (prev) => prev,
  });

  const sales = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function resetToFirstPage() {
    setPage(1);
  }

  function handleSort(key: string) {
    resetToFirstPage();
    handleSortChange(key);
  }

  const columns: DataTableColumn<Sale>[] = [
    {
      header: "Invoice",
      sortKey: "invoiceNumber",
      cell: (sale) => <span className="font-mono text-sm">{sale.invoiceNumber}</span>,
    },
    {
      header: "Date",
      sortKey: "completedAt",
      cell: (sale) =>
        sale.completedAt ? (
          <>
            <p>{new Date(sale.completedAt).toLocaleDateString()}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(sale.completedAt).toLocaleTimeString()}
            </p>
          </>
        ) : (
          "—"
        ),
    },
    {
      header: "Cashier",
      sortKey: "cashier",
      cell: (sale) => sale.cashier.name,
    },
    {
      header: "Payment",
      sortKey: "paymentMethod",
      cell: (sale) => (
        <Badge variant="outline">{paymentMethodLabel(sale.paymentMethod)}</Badge>
      ),
    },
    {
      header: "Total",
      sortKey: "totalAmount",
      headerClassName: "text-right",
      cellClassName: "text-right font-medium",
      cell: (sale) => formatMoney(sale.totalAmount),
    },
    {
      header: "Status",
      cell: (sale) => <RefundBadge sale={sale} />,
    },
    {
      header: "",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (sale) => (
        <Button
          variant="ghost"
          size="icon-sm"
          render={<Link href={`${baseHref}/${sale.id}`} />}
          nativeButton={false}
          aria-label={`View ${sale.invoiceNumber}`}
        >
          <Eye className="size-4" />
        </Button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="sales-invoice">Invoice #</Label>
          <Input
            id="sales-invoice"
            className="w-40"
            placeholder="INV-000042"
            value={invoiceNumber}
            onChange={(e) => {
              setInvoiceNumber(e.target.value);
              resetToFirstPage();
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sales-from">From</Label>
          <Input
            id="sales-from"
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              resetToFirstPage();
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sales-to">To</Label>
          <Input
            id="sales-to"
            type="date"
            className="w-40"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              resetToFirstPage();
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="sales-product">Product</Label>
          <Combobox
            id="sales-product"
            className="w-56"
            value={productId}
            onValueChange={(v) => {
              setProductId(v || ALL_PRODUCTS);
              resetToFirstPage();
            }}
            searchPlaceholder="Search products…"
            options={[
              { value: ALL_PRODUCTS, label: "All products" },
              ...(products?.map((p) => ({ value: p.id, label: p.name })) ?? []),
            ]}
          />
        </div>
      </div>

      {isLoading && !data ? (
        <DataTable
          columns={columns}
          rows={undefined}
          isLoading
          emptyMessage="No sales found."
          keyExtractor={(s) => s.id}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSort}
        />
      ) : (
        <div className={`transition-opacity ${isFetching ? "opacity-70" : ""}`}>
          <DataTable
            columns={columns}
            rows={sales}
            isLoading={false}
            emptyMessage="No sales found."
            keyExtractor={(s) => s.id}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSort}
          />
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} ({total} sales)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
