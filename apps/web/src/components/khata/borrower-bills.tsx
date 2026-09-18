"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DateRangeFilter } from "@/components/reports/date-range-filter";
import { centsToInput, formatMoney, inputToCents } from "@/lib/money";
import {
  fetchBorrowerBills,
  khataKeys,
  payAllOutstanding,
  payFromCredit,
  recordKhataPayment,
  type BorrowerBill,
  type BorrowerPayment,
  type KhataPaymentMethod,
} from "@/lib/khata";
import { useCurrencySymbol } from "@/lib/settings";
import { createRefund, fetchSale, salesKeys, type PaymentStatus, type RefundItemInput } from "@/lib/sales";
import { useSortedRows } from "@/lib/use-sort";

function StatusBadge({ status }: { status: PaymentStatus }) {
  if (status === "PAID") return <Badge variant="secondary">Paid</Badge>;
  if (status === "PARTIALLY_PAID") return <Badge variant="outline">Partially paid</Badge>;
  return <Badge variant="destructive">Unpaid</Badge>;
}

function RefundBadge({ bill }: { bill: BorrowerBill }) {
  if (bill.refundedAmount === 0) return null;
  const fullyRefunded = bill.refundedAmount >= bill.totalAmount;
  return (
    <Badge variant={fullyRefunded ? "destructive" : "secondary"}>
      {fullyRefunded ? "Refunded" : "Partially refunded"}
    </Badge>
  );
}

/**
 * Admin-only escape hatch for a bill that was raised in error — fully refunds
 * whatever quantity hasn't already been refunded (restocking it) and records
 * why, which zeroes the bill's amountDue and drops it out of every
 * outstanding-khata calculation without ever deleting the underlying sale.
 */
function RemoveBillDialog({ bill, borrowerId }: { bill: BorrowerBill; borrowerId: string }) {
  const queryClient = useQueryClient();
  const currencySymbol = useCurrencySymbol();

  const mutation = useMutation({
    mutationFn: async () => {
      const sale = await fetchSale(bill.id);
      const items: RefundItemInput[] = sale.items
        .filter((item) => (item.refundableQuantity ?? 0) > 0)
        .map((item) => ({ saleItemId: item.id, quantity: item.refundableQuantity! }));
      if (items.length === 0) {
        throw new Error("This bill has already been fully refunded.");
      }
      return createRefund(bill.id, items, "Removed from khata by admin");
    },
    onSuccess: (refund) => {
      toast.success(
        `Removed ${bill.invoiceNumber} from khata — refunded ${formatMoney(refund.totalAmount, currencySymbol)} and restocked its items.`,
      );
      queryClient.invalidateQueries({ queryKey: khataKeys.borrower(borrowerId) });
      queryClient.invalidateQueries({ queryKey: khataKeys.all });
      queryClient.invalidateQueries({ queryKey: salesKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (bill.refundedAmount >= bill.totalAmount) return null;

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${bill.invoiceNumber} from khata`}>
            <Trash2 className="size-4" />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {bill.invoiceNumber} from khata?</AlertDialogTitle>
          <AlertDialogDescription>
            This fully refunds the bill, restocks its items, and clears it from this borrower&apos;s khata
            balance. This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Removing…" : "Remove & refund"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Payment method + conditional transfer reference — shared by
 * RecordPaymentDialog and PayAllDialog, mirrors CheckoutDialog's own method
 * select. `idPrefix` keeps the two dialogs' Select trigger ids unique, since
 * both stay mounted (just hidden) at once.
 */
function PaymentMethodFields({
  idPrefix,
  method,
  onMethodChange,
  transferReference,
  onTransferReferenceChange,
}: {
  idPrefix: string;
  method: KhataPaymentMethod;
  onMethodChange: (method: KhataPaymentMethod) => void;
  transferReference: string;
  onTransferReferenceChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${idPrefix}-method`}>Received via</Label>
      <Select value={method} onValueChange={(v) => v && onMethodChange(v as KhataPaymentMethod)}>
        <SelectTrigger id={`${idPrefix}-method`} className="w-full">
          <SelectValue>{(v: string) => (v === "CASH" ? "Cash" : "Online Transfer")}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="CASH">Cash</SelectItem>
          <SelectItem value="TRANSFER">Online Transfer</SelectItem>
        </SelectContent>
      </Select>
      {method === "TRANSFER" && (
        <Input
          id={`${idPrefix}-transfer-reference`}
          value={transferReference}
          onChange={(e) => onTransferReferenceChange(e.target.value)}
          placeholder="Transfer reference (optional)"
        />
      )}
    </div>
  );
}

function RecordPaymentDialog({ bill, borrowerId }: { bill: BorrowerBill; borrowerId: string }) {
  const queryClient = useQueryClient();
  const currencySymbol = useCurrencySymbol();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(centsToInput(bill.amountDue));
  const [method, setMethod] = useState<KhataPaymentMethod>("CASH");
  const [transferReference, setTransferReference] = useState("");
  const [note, setNote] = useState("");

  const amountCents = inputToCents(amount);
  const overpaidCents = Math.max(0, amountCents - bill.amountDue);

  const mutation = useMutation({
    mutationFn: () =>
      recordKhataPayment(bill.id, amountCents, method, transferReference || undefined, note || undefined),
    onSuccess: (result) => {
      toast.success(
        result.creditAdded > 0
          ? `Payment recorded. ${formatMoney(result.creditAdded, currencySymbol)} added to the borrower's credit balance.`
          : "Payment recorded.",
      );
      queryClient.invalidateQueries({ queryKey: khataKeys.borrower(borrowerId) });
      queryClient.invalidateQueries({ queryKey: khataKeys.all });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      setAmount(centsToInput(bill.amountDue));
      setMethod("CASH");
      setTransferReference("");
      setNote("");
    }
    setOpen(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amountCents <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button variant="outline" size="sm">
          Record payment
        </Button>
      }
      title={`Record payment — ${bill.invoiceNumber}`}
      description={`Amount due: ${formatMoney(bill.amountDue, currencySymbol)}`}
      footer={
        <Button form="khata-payment-form" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Record payment"}
        </Button>
      }
      size="sm"
    >
      <form id="khata-payment-form" onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="payment-amount">Amount</Label>
          <Input
            id="payment-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          {overpaidCents > 0 && (
            <p className="text-sm text-muted-foreground">
              {`${formatMoney(overpaidCents, currencySymbol)} more than due — the excess will be added to the borrower's credit balance.`}
            </p>
          )}
        </div>
        <PaymentMethodFields
          idPrefix="khata-payment"
          method={method}
          onMethodChange={setMethod}
          transferReference={transferReference}
          onTransferReferenceChange={setTransferReference}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="payment-note">Note (optional)</Label>
          <Input id="payment-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}

function PayAllDialog({
  borrowerId,
  borrowerName,
  totalDue,
}: {
  borrowerId: string;
  borrowerName: string;
  totalDue: number;
}) {
  const queryClient = useQueryClient();
  const currencySymbol = useCurrencySymbol();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(centsToInput(totalDue));
  const [method, setMethod] = useState<KhataPaymentMethod>("CASH");
  const [transferReference, setTransferReference] = useState("");

  const amountCents = inputToCents(amount);
  const isFullPayment = amountCents >= totalDue;
  const isExactFullPayment = amountCents === totalDue;
  const overpaidCents = Math.max(0, amountCents - totalDue);

  const mutation = useMutation({
    // An exact full payment omits `amount` so the server settles by total due
    // directly, sidestepping any rounding drift from the cents<->input
    // round-trip on a large multi-bill balance. Anything else — including an
    // overpayment — passes the amount through so the excess becomes credit.
    mutationFn: () =>
      payAllOutstanding(
        borrowerId,
        method,
        isExactFullPayment ? undefined : amountCents,
        transferReference || undefined,
      ),
    onSuccess: (result) => {
      const settledMessage = `Settled ${result.settledBillCount} bill${result.settledBillCount === 1 ? "" : "s"} (${formatMoney(result.totalSettled, currencySymbol)}).`;
      toast.success(
        result.creditAdded > 0
          ? `${settledMessage} ${formatMoney(result.creditAdded, currencySymbol)} added to the borrower's credit balance.`
          : settledMessage,
      );
      queryClient.invalidateQueries({ queryKey: khataKeys.borrower(borrowerId) });
      queryClient.invalidateQueries({ queryKey: khataKeys.all });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      setAmount(centsToInput(totalDue));
      setMethod("CASH");
      setTransferReference("");
    }
    setOpen(next);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (amountCents <= 0) {
      toast.error("Enter an amount greater than zero.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={<Button disabled={totalDue <= 0}>Pay khata ({formatMoney(totalDue, currencySymbol)})</Button>}
      title={`Settle khata — ${borrowerName}`}
      description={`Total due: ${formatMoney(totalDue, currencySymbol)}. Oldest bills are settled first.`}
      footer={
        <Button form="pay-all-form" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Settling…" : isFullPayment ? "Pay full khata" : "Record partial payment"}
        </Button>
      }
      size="sm"
    >
      <form id="pay-all-form" onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pay-all-amount">Amount</Label>
          <Input
            id="pay-all-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          <p className="text-sm text-muted-foreground">
            {overpaidCents > 0
              ? `${formatMoney(overpaidCents, currencySymbol)} more than due — the excess will be added to the borrower's credit balance.`
              : "Defaults to the full balance — lower it for a partial payment."}
          </p>
        </div>
        <PaymentMethodFields
          idPrefix="khata-pay-all"
          method={method}
          onMethodChange={setMethod}
          transferReference={transferReference}
          onTransferReferenceChange={setTransferReference}
        />
      </form>
    </Modal>
  );
}

/** One-click settlement using the borrower's existing store credit balance — no amount to enter, so no dialog needed. */
function PayFromCreditButton({
  borrowerId,
  totalDue,
  creditBalance,
}: {
  borrowerId: string;
  totalDue: number;
  creditBalance: number;
}) {
  const queryClient = useQueryClient();
  const currencySymbol = useCurrencySymbol();
  const applied = Math.min(creditBalance, totalDue);

  const mutation = useMutation({
    mutationFn: () => payFromCredit(borrowerId),
    onSuccess: (result) => {
      toast.success(
        `Settled ${result.settledBillCount} bill${result.settledBillCount === 1 ? "" : "s"} (${formatMoney(result.totalSettled, currencySymbol)}) from credit.`,
      );
      queryClient.invalidateQueries({ queryKey: khataKeys.borrower(borrowerId) });
      queryClient.invalidateQueries({ queryKey: khataKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (creditBalance <= 0 || totalDue <= 0) return null;

  return (
    <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
      {mutation.isPending
        ? "Applying…"
        : applied >= totalDue
          ? `Pay full khata from credit (${formatMoney(applied, currencySymbol)})`
          : `Apply credit (${formatMoney(applied, currencySymbol)})`}
    </Button>
  );
}

const SORT_ACCESSORS: Record<string, (bill: BorrowerBill) => string | number | null> = {
  invoiceNumber: (bill) => bill.invoiceNumber,
  completedAt: (bill) => bill.completedAt,
  totalAmount: (bill) => bill.totalAmount,
  amountPaid: (bill) => bill.amountPaid,
  amountDue: (bill) => bill.amountDue,
  paymentStatus: (bill) => bill.paymentStatus,
};

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export function BorrowerBills({
  borrowerId,
  saleBaseHref,
  isAdmin,
}: {
  borrowerId: string;
  saleBaseHref: string;
  isAdmin: boolean;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const dateParams = { from: from || undefined, to: to || undefined };
  const isFiltered = Boolean(from || to);

  const statementQuery = new URLSearchParams();
  if (from) statementQuery.set("from", from);
  if (to) statementQuery.set("to", to);
  const statementHref = `/khata/${borrowerId}/statement?${statementQuery}`;

  const { data, isLoading } = useQuery({
    queryKey: khataKeys.borrower(borrowerId, dateParams),
    queryFn: () => fetchBorrowerBills(borrowerId, dateParams),
  });
  const currencySymbol = useCurrencySymbol();

  const { sortedRows: bills, sortBy, sortOrder, handleSortChange } = useSortedRows(
    data?.sales,
    SORT_ACCESSORS,
    "completedAt",
    "desc",
  );
  const totalDue = data?.summary.totalDue ?? 0;

  const columns: DataTableColumn<BorrowerBill>[] = [
    {
      header: "Invoice",
      sortKey: "invoiceNumber",
      cell: (bill) => (
        <Link href={`${saleBaseHref}/${bill.id}`} className="font-mono text-sm underline-offset-2 hover:underline">
          {bill.invoiceNumber}
        </Link>
      ),
    },
    {
      header: "Date",
      sortKey: "completedAt",
      cell: (bill) => (bill.completedAt ? new Date(bill.completedAt).toLocaleDateString() : "—"),
    },
    {
      header: "Total",
      sortKey: "totalAmount",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (bill) => formatMoney(bill.totalAmount, currencySymbol),
    },
    {
      header: "Paid",
      sortKey: "amountPaid",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (bill) => formatMoney(bill.amountPaid, currencySymbol),
    },
    {
      header: "Due",
      sortKey: "amountDue",
      headerClassName: "text-right",
      cellClassName: "text-right font-medium",
      cell: (bill) => formatMoney(bill.amountDue, currencySymbol),
    },
    {
      header: "Status",
      sortKey: "paymentStatus",
      cell: (bill) => <StatusBadge status={bill.paymentStatus} />,
    },
    {
      header: "Refund",
      cell: (bill) => <RefundBadge bill={bill} />,
    },
    {
      header: "",
      headerClassName: "text-right",
      cellClassName: "text-right",
      cell: (bill) => (
        <div className="flex items-center justify-end gap-1">
          {bill.amountDue > 0 && <RecordPaymentDialog bill={bill} borrowerId={borrowerId} />}
          {isAdmin && <RemoveBillDialog bill={bill} borrowerId={borrowerId} />}
        </div>
      ),
    },
  ];

  const paymentColumns: DataTableColumn<BorrowerPayment>[] = [
    {
      header: "Date",
      cell: (payment) => new Date(payment.createdAt).toLocaleString(),
    },
    {
      header: "Invoice",
      cell: (payment) => (
        <Link
          href={`${saleBaseHref}/${payment.saleId}`}
          className="font-mono text-sm underline-offset-2 hover:underline"
        >
          {payment.invoiceNumber}
        </Link>
      ),
    },
    {
      header: "Amount",
      headerClassName: "text-right",
      cellClassName: "text-right font-medium",
      cell: (payment) => formatMoney(payment.amount, currencySymbol),
    },
    {
      header: "Method",
      cell: (payment) =>
        payment.method === "TRANSFER" ? "Online Transfer" : payment.method === "CASH" ? "Cash" : "Store credit",
    },
    {
      header: "Received by",
      cell: (payment) => payment.receivedBy.name,
    },
    {
      header: "Note",
      cell: (payment) => <span className="text-muted-foreground">{payment.note ?? "—"}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {data && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
            <p className="text-muted-foreground">
              {data.phone ? `${data.phone} — ` : ""}
              {formatMoney(totalDue, currencySymbol)} outstanding
              {data.creditBalance > 0 && (
                <> · {formatMoney(data.creditBalance, currencySymbol)} credit available</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" render={<Link href={statementHref} target="_blank" />} nativeButton={false}>
              <FileText className="size-4" />
              Download statement
            </Button>
            <PayFromCreditButton borrowerId={borrowerId} totalDue={totalDue} creditBalance={data.creditBalance} />
            <PayAllDialog borrowerId={borrowerId} borrowerName={data.name} totalDue={totalDue} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label={isFiltered ? "Billed (filtered)" : "Billed (all time)"}
          value={formatMoney(data?.summary.totalBilled ?? 0, currencySymbol)}
        />
        <SummaryCard
          label={isFiltered ? "Paid (filtered)" : "Paid (all time)"}
          value={formatMoney(data?.summary.totalPaid ?? 0, currencySymbol)}
        />
        <SummaryCard label="Remaining balance" value={formatMoney(totalDue, currencySymbol)} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangeFilter
            idPrefix="khata-history"
            from={from}
            to={to}
            onFromChange={setFrom}
            onToChange={setTo}
            defaultLabel="Showing the complete history."
          />
        </div>
        <div>
          <h2 className="text-lg font-medium">Purchases</h2>
          <DataTable
            columns={columns}
            rows={isLoading ? undefined : bills}
            isLoading={isLoading}
            emptyMessage="No khata bills for this borrower in this range."
            keyExtractor={(bill) => bill.id}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
          />
        </div>
        <div>
          <h2 className="text-lg font-medium">Payments</h2>
          <DataTable
            columns={paymentColumns}
            rows={isLoading ? undefined : data?.payments}
            isLoading={isLoading}
            emptyMessage="No payments recorded for this borrower in this range."
            keyExtractor={(payment) => payment.id}
          />
        </div>
      </div>
    </div>
  );
}
