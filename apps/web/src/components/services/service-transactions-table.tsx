"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Combobox } from "@/components/ui/combobox";
import { exportToCsv, type CsvColumn } from "@/lib/csv";
import { formatMoney } from "@/lib/money";
import { paymentMethodLabel } from "@/lib/sales";
import { useCurrencySymbol } from "@/lib/settings";
import { useSortState } from "@/lib/use-sort";
import {
  fetchActiveServices,
  fetchAllServiceTransactions,
  fetchServiceTransactions,
  serviceTransactionsKeys,
  servicesKeys,
  type ServiceTransaction,
} from "@/lib/services";
import { DateRangeFilter } from "@/components/reports/date-range-filter";

const PAGE_SIZE = 20;
const ALL_SERVICES = "all";

const CSV_COLUMNS: CsvColumn<ServiceTransaction>[] = [
  { header: "Transaction #", accessor: (t) => t.transactionNumber },
  { header: "Date", accessor: (t) => new Date(t.createdAt).toLocaleString() },
  { header: "Service", accessor: (t) => t.service.name },
  { header: "Cashier", accessor: (t) => t.cashier.name },
  { header: "Reference #", accessor: (t) => t.referenceNumber ?? "" },
  { header: "Bill Amount", accessor: (t) => t.billAmount / 100 },
  { header: "Service Fee", accessor: (t) => t.serviceFee / 100 },
  {
    header: "Fee Mode",
    accessor: (t) =>
      t.direction === "BILL_PAYMENT" ? "" : t.feeInclusive ? "Included" : "Excluded",
  },
  { header: "Total", accessor: (t) => t.totalAmount / 100 },
  { header: "Payment", accessor: (t) => paymentMethodLabel(t.paymentMethod) },
  { header: "Amount Received", accessor: (t) => t.amountReceived / 100 },
  { header: "Change", accessor: (t) => t.changeDue / 100 },
  { header: "Transfer Reference", accessor: (t) => t.transferReference ?? "" },
  { header: "Note", accessor: (t) => t.note ?? "" },
];

/**
 * A cashier sees only their own transactions here (enforced server-side by
 * ServiceTransactionsService.findAll) — an admin sees every cashier's, with
 * a Cashier column to tell them apart. Shared by /admin/services'
 * Transactions tab and /cashier/sales' Services tab.
 */
export function ServiceTransactionsTable() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [serviceId, setServiceId] = useState(ALL_SERVICES);
  const [isExporting, setIsExporting] = useState(false);
  const currencySymbol = useCurrencySymbol();
  const { sortBy, sortOrder, handleSortChange } = useSortState("createdAt", "desc");

  const { data: services } = useQuery({ queryKey: servicesKeys.active(), queryFn: fetchActiveServices });

  const filterParams = {
    from: from || undefined,
    to: to || undefined,
    serviceId: serviceId === ALL_SERVICES ? undefined : serviceId,
  };
  const params = { page, pageSize: PAGE_SIZE, sortBy, sortOrder, ...filterParams };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: serviceTransactionsKeys.list(params),
    queryFn: () => fetchServiceTransactions(params),
    placeholderData: (prev) => prev,
  });

  const transactions = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function resetToFirstPage() {
    setPage(1);
  }

  function handleSort(key: string) {
    resetToFirstPage();
    handleSortChange(key);
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const all = await fetchAllServiceTransactions({ ...filterParams, sortBy, sortOrder });
      if (all.length === 0) {
        toast.error("Nothing to export for the current filters.");
        return;
      }
      exportToCsv("service-transactions", CSV_COLUMNS, all);
    } catch {
      toast.error("Could not export transactions.");
    } finally {
      setIsExporting(false);
    }
  }

  const columns: DataTableColumn<ServiceTransaction>[] = [
    {
      header: "Transaction #",
      sortKey: "transactionNumber",
      cell: (t) => <span className="font-mono text-sm">{t.transactionNumber}</span>,
    },
    {
      header: "Date",
      sortKey: "createdAt",
      cell: (t) => (
        <>
          <p>{new Date(t.createdAt).toLocaleDateString()}</p>
          <p className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleTimeString()}</p>
        </>
      ),
    },
    {
      header: "Service",
      sortKey: "service",
      cell: (t) => <Badge variant="outline">{t.service.name}</Badge>,
    },
    {
      header: "Cashier",
      sortKey: "cashier",
      cell: (t) => t.cashier.name,
    },
    {
      header: "Reference #",
      cell: (t) => <span className="text-muted-foreground">{t.referenceNumber ?? "—"}</span>,
    },
    {
      header: "Fee",
      headerClassName: "text-right",
      cellClassName: "text-right text-muted-foreground",
      cell: (t) =>
        t.direction === "BILL_PAYMENT" ? (
          formatMoney(t.serviceFee, currencySymbol)
        ) : (
          <>
            {formatMoney(t.serviceFee, currencySymbol)}
            {t.serviceFee > 0 && (
              <span className="ml-1 text-xs">{t.feeInclusive ? "(included)" : "(excluded)"}</span>
            )}
          </>
        ),
    },
    {
      header: "Total",
      sortKey: "totalAmount",
      headerClassName: "text-right",
      cellClassName: "text-right font-medium",
      cell: (t) => formatMoney(t.totalAmount, currencySymbol),
    },
    {
      header: "Payment",
      cell: (t) => <Badge variant="secondary">{paymentMethodLabel(t.paymentMethod)}</Badge>,
    },
    {
      header: "Change",
      headerClassName: "text-right",
      cellClassName: "text-right text-muted-foreground",
      cell: (t) => formatMoney(t.changeDue, currencySymbol),
    },
    {
      header: "Transfer Reference",
      cell: (t) => <span className="font-mono text-sm">{t.transferReference ?? "—"}</span>,
    },
    {
      header: "Note",
      cell: (t) => <span className="text-muted-foreground">{t.note ?? "—"}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter
            idPrefix="service-tx"
            from={from}
            to={to}
            onFromChange={(v) => {
              setFrom(v);
              resetToFirstPage();
            }}
            onToChange={(v) => {
              setTo(v);
              resetToFirstPage();
            }}
            defaultLabel="Showing all transactions."
          />
          <Combobox
            className="w-56"
            value={serviceId}
            onValueChange={(v) => {
              setServiceId(v || ALL_SERVICES);
              resetToFirstPage();
            }}
            searchPlaceholder="Search services…"
            options={[
              { value: ALL_SERVICES, label: "All services" },
              ...(services?.map((s) => ({ value: s.id, label: s.name })) ?? []),
            ]}
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting || total === 0}>
          <Download className="size-4" />
          {isExporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      {isLoading && !data ? (
        <DataTable
          columns={columns}
          rows={undefined}
          isLoading
          emptyMessage="No service transactions found."
          keyExtractor={(t) => t.id}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSort}
        />
      ) : (
        <div className={`transition-opacity ${isFetching ? "opacity-70" : ""}`}>
          <DataTable
            columns={columns}
            rows={transactions}
            isLoading={false}
            emptyMessage="No service transactions found."
            keyExtractor={(t) => t.id}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSort}
          />
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {page} of {totalPages} ({total} transactions)
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
