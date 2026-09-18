"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { centsToInput, formatMoney, inputToCents } from "@/lib/money";
import {
  computeTieredFee,
  createServiceTransaction,
  fetchActiveServices,
  serviceTransactionsKeys,
  servicesKeys,
  SERVICE_DIRECTION_LABELS,
  type Service,
  type ServicePaymentMethod,
} from "@/lib/services";

export function ServiceTransactionDialog() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [service, setService] = useState<Service | null>(null);
  const [serviceSearch, setServiceSearch] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [serviceFee, setServiceFee] = useState("");
  const [method, setMethod] = useState<ServicePaymentMethod>("CASH");
  const [amountReceived, setAmountReceived] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [note, setNote] = useState("");
  const [feeInclusive, setFeeInclusive] = useState(false);

  const { data: services, isLoading } = useQuery({
    queryKey: servicesKeys.active(),
    queryFn: fetchActiveServices,
    enabled: open,
  });
  const filteredServices = services?.filter((s) =>
    s.name.toLowerCase().includes(serviceSearch.trim().toLowerCase()),
  );

  const isBillPayment = (service?.direction ?? "BILL_PAYMENT") === "BILL_PAYMENT";
  const isWithdrawal = service?.direction === "CASH_WITHDRAWAL";

  const billCents = inputToCents(billAmount);
  const isTiered = service?.useTieredFee ?? false;
  const feeCents = isTiered
    ? computeTieredFee(billCents, service?.feePerThousand ?? 0)
    : inputToCents(serviceFee);

  // A withdrawal/deposit has a money-in side (a transfer for a withdrawal,
  // cash for a deposit) and a money-out side (cash for a withdrawal, a
  // transfer for a deposit), with fee = amountIn - amountOut. billAmount is
  // whichever side feeInclusive fixes — see ServiceTransactionsService.
  // buildCashFlowData for the full four-case breakdown this mirrors.
  const amountIn = feeInclusive ? billCents : billCents + feeCents;
  const amountOut = feeInclusive ? billCents - feeCents : billCents;
  // totalAmount is always whichever side hits the cash drawer: the payout
  // for a withdrawal, the cash collected for a deposit. Bill payments have
  // no in/out split — the fee is simply added to the bill.
  const totalCents = isBillPayment ? billCents + feeCents : isWithdrawal ? amountOut : amountIn;
  const receivedCents = inputToCents(amountReceived);
  const changeCents = receivedCents - totalCents;
  const isShort = method === "CASH" && receivedCents > 0 && changeCents < 0;
  const feeExceedsAmount = !isBillPayment && billCents > 0 && amountOut <= 0;

  function reset() {
    setService(null);
    setServiceSearch("");
    setReferenceNumber("");
    setBillAmount("");
    setServiceFee("");
    setMethod("CASH");
    setAmountReceived("");
    setTransferReference("");
    setNote("");
    setFeeInclusive(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    setOpen(next);
  }

  function selectService(s: Service) {
    setService(s);
    setServiceFee(!s.useTieredFee && s.defaultFee != null ? centsToInput(s.defaultFee) : "");
    // Matches this pair's most common real-world shape by default — the
    // cashier can still flip it before confirming.
    setFeeInclusive(s.direction === "CASH_WITHDRAWAL");
  }

  const mutation = useMutation({
    mutationFn: () =>
      isBillPayment
        ? createServiceTransaction({
            serviceId: service!.id,
            referenceNumber: referenceNumber || undefined,
            billAmount: billCents,
            serviceFee: feeCents,
            paymentMethod: method,
            ...(method === "TRANSFER"
              ? { transferReference }
              : { amountReceived: receivedCents }),
          })
        : createServiceTransaction({
            serviceId: service!.id,
            billAmount: billCents,
            serviceFee: feeCents,
            feeInclusive,
            transferReference,
            note: note || undefined,
          }),
    onSuccess: (transaction) => {
      toast.success(
        isBillPayment
          ? method === "TRANSFER"
            ? `${transaction.transactionNumber} recorded.`
            : `${transaction.transactionNumber} recorded — ${formatMoney(transaction.changeDue)} change due.`
          : `${transaction.transactionNumber} recorded.`,
      );
      queryClient.invalidateQueries({ queryKey: serviceTransactionsKeys.all });
      handleOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isBillPayment) {
      if (billCents <= 0) {
        toast.error("Enter an amount greater than zero.");
        return;
      }
      if (feeExceedsAmount) {
        toast.error("The fee cannot be greater than or equal to the amount above.");
        return;
      }
      if (!transferReference.trim()) {
        toast.error("A transfer reference is required.");
        return;
      }
      mutation.mutate();
      return;
    }

    if (totalCents <= 0) {
      toast.error("Enter a bill amount or service fee greater than zero.");
      return;
    }
    if (method === "TRANSFER") {
      if (!transferReference.trim()) {
        toast.error("A transfer reference is required.");
        return;
      }
    } else if (receivedCents < totalCents) {
      toast.error("Amount received is less than the total due.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button variant="outline">
          <Receipt className="size-4" />
          Services
        </Button>
      }
      title={service ? service.name : "Services"}
      description={service ? undefined : "Select a service to record a transaction."}
      footer={
        service && (
          <Button form="service-transaction-form" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Processing…" : "Confirm transaction"}
          </Button>
        )
      }
    >
      {!service ? (
        <div className="flex flex-col gap-2 pt-2">
          {services && services.length > 0 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search services…"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading services…</p>
          ) : !services || services.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No active services yet — add one from Admin → Services.
            </p>
          ) : !filteredServices || filteredServices.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No services match &quot;{serviceSearch}&quot;.
            </p>
          ) : (
            filteredServices.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectService(s)}
                className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/50"
              >
                <span className="font-medium">{s.name}</span>
                {s.direction !== "BILL_PAYMENT" ? (
                  <span className="text-sm text-muted-foreground">
                    {SERVICE_DIRECTION_LABELS[s.direction]}
                  </span>
                ) : s.useTieredFee ? (
                  <span className="text-sm text-muted-foreground">
                    Fee: {formatMoney(s.feePerThousand ?? 0)} / 1,000
                  </span>
                ) : (
                  s.defaultFee != null && (
                    <span className="text-sm text-muted-foreground">
                      Fee: {formatMoney(s.defaultFee)}
                    </span>
                  )
                )}
              </button>
            ))
          )}
        </div>
      ) : isBillPayment ? (
        <form
          id="service-transaction-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 pt-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => setService(null)}
          >
            <ArrowLeft className="size-4" />
            Change service
          </Button>

          <div className="flex flex-col gap-2">
            <Label htmlFor="svc-reference">Customer / reference number (optional)</Label>
            <Input
              id="svc-reference"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. meter or account number"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="svc-bill">Bill amount</Label>
              <Input
                id="svc-bill"
                type="number"
                step="0.01"
                min="0"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="svc-fee">Service fee</Label>
              {isTiered ? (
                <>
                  <Input id="svc-fee" value={formatMoney(feeCents)} disabled readOnly />
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(service?.feePerThousand ?? 0)} per Rs 1,000, rounded up
                  </p>
                </>
              ) : (
                <Input
                  id="svc-fee"
                  type="number"
                  step="0.01"
                  min="0"
                  value={serviceFee}
                  onChange={(e) => setServiceFee(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
            <span className="text-sm text-muted-foreground">Total to collect</span>
            <span className="font-semibold">{formatMoney(totalCents)}</span>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="svc-method">Payment method</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v as ServicePaymentMethod)}>
              <SelectTrigger id="svc-method" className="w-full">
                <SelectValue>{(v: string) => (v === "CASH" ? "Cash" : "Online Transfer")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="TRANSFER">Online Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {method === "CASH" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="svc-received">Amount received from customer</Label>
              <Input
                id="svc-received"
                type="number"
                step="0.01"
                min="0"
                value={amountReceived}
                onChange={(e) => setAmountReceived(e.target.value)}
              />
              {isShort ? (
                <p className="text-sm text-destructive">
                  Short by {formatMoney(-changeCents)} — services must be paid in full.
                </p>
              ) : receivedCents > 0 ? (
                <p className="text-sm text-muted-foreground">Change due: {formatMoney(changeCents)}</p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Label htmlFor="svc-transfer-reference">Transfer reference</Label>
              <Input
                id="svc-transfer-reference"
                value={transferReference}
                onChange={(e) => setTransferReference(e.target.value)}
                placeholder="e.g. bank transaction ID"
              />
            </div>
          )}
        </form>
      ) : (
        <form
          id="service-transaction-form"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 pt-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => setService(null)}
          >
            <ArrowLeft className="size-4" />
            Change service
          </Button>

          <p className="text-sm text-muted-foreground">
            {isWithdrawal
              ? "Customer has transferred money to the shop's account — hand them cash back."
              : "Customer has given you cash — transfer the amount to their account on their behalf."}
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="svc-cash-amount">
              {isWithdrawal ? "Withdrawal amount" : "Deposit amount"}
            </Label>
            <Input
              id="svc-cash-amount"
              type="number"
              step="0.01"
              min="0"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="svc-cash-fee">Fee (optional)</Label>
            {isTiered ? (
              <>
                <Input id="svc-cash-fee" value={formatMoney(feeCents)} disabled readOnly />
                <p className="text-xs text-muted-foreground">
                  {formatMoney(service?.feePerThousand ?? 0)} per Rs 1,000, rounded up
                </p>
              </>
            ) : (
              <Input
                id="svc-cash-fee"
                type="number"
                step="0.01"
                min="0"
                value={serviceFee}
                onChange={(e) => setServiceFee(e.target.value)}
              />
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <Label htmlFor="svc-cash-fee-inclusive">Fee included in the amount above</Label>
              <p className="text-sm text-muted-foreground">
                {isWithdrawal
                  ? feeInclusive
                    ? "On — the amount above is what the customer sends; the fee is deducted from the cash paid out."
                    : "Off — the amount above is the cash paid out; the customer sends the amount plus fee separately."
                  : feeInclusive
                    ? "On — the amount above is what the customer pays in cash; the fee is deducted before transferring out."
                    : "Off — the amount above is what gets transferred out; the customer pays the amount plus fee in cash."}
              </p>
            </div>
            <Switch id="svc-cash-fee-inclusive" checked={feeInclusive} onCheckedChange={setFeeInclusive} />
          </div>

          <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {isWithdrawal ? "Customer sends (transfer in)" : "Customer pays (cash in)"}
              </span>
              <span className={isWithdrawal ? undefined : "font-semibold"}>{formatMoney(amountIn)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {isWithdrawal ? "Cash to hand over" : "Transferred out on their behalf"}
              </span>
              <span
                className={`${isWithdrawal ? "font-semibold" : ""} ${feeExceedsAmount ? "text-destructive" : ""}`}
              >
                {formatMoney(amountOut)}
              </span>
            </div>
          </div>
          {feeExceedsAmount && (
            <p className="text-sm text-destructive">
              The fee can&apos;t be greater than or equal to the amount above.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="svc-cash-transfer-reference">Transfer reference</Label>
            <Input
              id="svc-cash-transfer-reference"
              value={transferReference}
              onChange={(e) => setTransferReference(e.target.value)}
              placeholder="e.g. bank transaction ID"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="svc-cash-note">Note (optional)</Label>
            <Textarea
              id="svc-cash-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. customer name or phone number"
              rows={2}
            />
          </div>
        </form>
      )}
    </Modal>
  );
}
