"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { fetchBorrowers, khataKeys } from "@/lib/khata";
import { centsToInput, formatMoney, inputToCents } from "@/lib/money";
import { useCurrencySymbol } from "@/lib/settings";
import { checkout, salesKeys } from "@/lib/sales";
import { useCart, useCartTotals } from "./cart-context";

const NEW_BORROWER = "__new__";

// Cashier-facing payment methods. Full khata (customer pays nothing) and
// split (part cash, part khata) still exist as PaymentMethod values on the
// backend — they're just never picked directly. Instead, a shortfall on a
// Cash payment automatically offers to bill the difference to a customer,
// which sends CREDIT (nothing received) or SPLIT (something received) under
// the hood.
type Method = "CASH" | "TRANSFER";

interface Props {
  /** Where to send the user after a completed sale — defaults to the cashier invoice view. The admin Bulk Sale page overrides this to the admin invoice view, which also offers refunds. */
  invoiceHref?: (saleId: string) => string;
}

export function CheckoutDialog({ invoiceHref = (saleId) => `/cashier/sales/${saleId}` }: Props = {}) {
  const cart = useCart();
  const totals = useCartTotals();
  const currencySymbol = useCurrencySymbol();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<Method>("CASH");
  const [cashReceived, setCashReceived] = useState("");
  const [transferReference, setTransferReference] = useState("");
  const [overpaymentChoice, setOverpaymentChoice] = useState<"change" | "credit">("change");
  const [attachCustomer, setAttachCustomer] = useState(false);
  const [borrowerId, setBorrowerId] = useState<string>(NEW_BORROWER);
  const [newBorrowerName, setNewBorrowerName] = useState("");
  const [newBorrowerPhone, setNewBorrowerPhone] = useState("");
  const [useCredit, setUseCredit] = useState(true);

  const cashReceivedCents = inputToCents(cashReceived);
  const diff = cashReceivedCents - totals.totalAmount; // > 0 overpay, < 0 shortfall, 0 exact
  const isShortfall = method === "CASH" && diff < 0;
  const isOverpay = method === "CASH" && diff > 0;
  const shortfallCents = isShortfall ? -diff : 0;
  const overpayCents = isOverpay ? diff : 0;

  // A customer needs picking whenever this sale would create new khata debt
  // (a shortfall) or divert cash change into their credit balance instead of
  // handing it back. Outside of those cases, attaching a customer is purely
  // optional — the cashier can still opt in via "+ Attach a customer" even
  // on a fully-paid sale.
  const needsBorrower = isShortfall || (isOverpay && overpaymentChoice === "credit");
  const showCustomerSection = needsBorrower || attachCustomer;

  const { data: borrowers = [] } = useQuery({
    queryKey: khataKeys.borrowers(),
    queryFn: () => fetchBorrowers(),
    enabled: open && showCustomerSection,
  });
  const selectedBorrower = borrowerId !== NEW_BORROWER ? borrowers.find((b) => b.id === borrowerId) : undefined;
  // Existing store credit only ever offsets a shortfall (new debt) — it
  // plays no part when the customer is instead about to receive MORE credit.
  const creditApplied =
    isShortfall && useCredit && selectedBorrower ? Math.min(selectedBorrower.creditBalance, shortfallCents) : 0;
  const remainingShortfall = shortfallCents - creditApplied;

  function resetBorrowerFields() {
    setBorrowerId(NEW_BORROWER);
    setNewBorrowerName("");
    setNewBorrowerPhone("");
    setUseCredit(true);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      setMethod("CASH");
      setCashReceived(centsToInput(totals.totalAmount));
      setTransferReference("");
      setOverpaymentChoice("change");
      setAttachCustomer(false);
      resetBorrowerFields();
    }
    setOpen(next);
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "F5") {
        e.preventDefault();
        setMethod("CASH");
      } else if (e.key === "F6") {
        e.preventDefault();
        setMethod("TRANSFER");
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Outside of a forced pick (shortfall/overpay-to-credit), only attach a
  // customer if the cashier actually chose one — an untouched "+ Attach a
  // customer" section (still on the new-customer sentinel with no name
  // typed) should silently attach nobody rather than block checkout.
  const hasChosenBorrower = borrowerId !== NEW_BORROWER || newBorrowerName.trim().length > 0;
  const shouldAttachBorrower = showCustomerSection && hasChosenBorrower;

  const mutation = useMutation({
    mutationFn: () => {
      const borrowerFields = !shouldAttachBorrower
        ? {}
        : borrowerId === NEW_BORROWER
          ? { newBorrowerName, newBorrowerPhone: newBorrowerPhone || undefined }
          : { borrowerId };

      if (method === "TRANSFER") {
        return checkout(
          cart.toCartLineInputs(),
          { paymentMethod: "TRANSFER", transferReference, ...borrowerFields },
          cart.draftId ?? undefined,
        );
      }
      if (isShortfall) {
        return checkout(
          cart.toCartLineInputs(),
          cashReceivedCents <= 0
            ? { paymentMethod: "CREDIT", useCredit, ...borrowerFields }
            : { paymentMethod: "SPLIT", cashAmount: cashReceivedCents, useCredit, ...borrowerFields },
          cart.draftId ?? undefined,
        );
      }
      if (isOverpay && overpaymentChoice === "credit") {
        return checkout(
          cart.toCartLineInputs(),
          { paymentMethod: "CASH", cashTendered: cashReceivedCents, creditChangeToBorrower: true, ...borrowerFields },
          cart.draftId ?? undefined,
        );
      }
      return checkout(
        cart.toCartLineInputs(),
        { paymentMethod: "CASH", cashTendered: cashReceivedCents, ...borrowerFields },
        cart.draftId ?? undefined,
      );
    },
    onSuccess: (sale) => {
      toast.success(`Sale ${sale.invoiceNumber} completed.`);
      queryClient.invalidateQueries({ queryKey: salesKeys.drafts() });
      queryClient.invalidateQueries({ queryKey: khataKeys.all });
      cart.replace(null, []);
      setOpen(false);
      router.push(invoiceHref(sale.id));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (method === "TRANSFER" && !transferReference.trim()) {
      toast.error("A transfer reference is required.");
      return;
    }
    if (needsBorrower && borrowerId === NEW_BORROWER && !newBorrowerName.trim()) {
      toast.error("Select or add a customer to continue.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={
        <Button id="pos-checkout-trigger" disabled={cart.lines.length === 0}>
          Checkout (F4)
        </Button>
      }
      title="Checkout"
      description={`Total due: ${formatMoney(totals.totalAmount, currencySymbol)}`}
      footer={
        <Button form="checkout-form" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Processing…" : "Confirm payment (Enter)"}
        </Button>
      }
    >
      <form id="checkout-form" onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="payment-method">Payment method</Label>
          <Select value={method} onValueChange={(v) => v && setMethod(v as Method)}>
            <SelectTrigger id="payment-method" className="w-full">
              <SelectValue>{(v: string) => (v === "CASH" ? "Cash (F5)" : "Online Transfer (F6)")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CASH">Cash (F5)</SelectItem>
              <SelectItem value="TRANSFER">Online Transfer (F6)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {method === "CASH" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="cash-received">Amount received</Label>
            <Input
              id="cash-received"
              type="number"
              step="0.01"
              min="0"
              value={cashReceived}
              onChange={(e) => setCashReceived(e.target.value)}
              autoFocus
            />
            {isShortfall ? (
              <p className="text-sm text-destructive">
                {`Short by ${formatMoney(shortfallCents, currencySymbol)} — select a customer below to bill the difference to their khata.`}
              </p>
            ) : isOverpay ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">{`${formatMoney(overpayCents, currencySymbol)} more than the bill.`}</p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={overpaymentChoice === "change" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setOverpaymentChoice("change")}
                  >
                    Return change
                  </Button>
                  <Button
                    type="button"
                    variant={overpaymentChoice === "credit" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setOverpaymentChoice("credit")}
                  >
                    Credit to customer
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Exact amount — no change due.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="transfer-reference">Transfer reference</Label>
            <Input
              id="transfer-reference"
              value={transferReference}
              onChange={(e) => setTransferReference(e.target.value)}
              placeholder="e.g. bank transaction ID"
              autoFocus
            />
          </div>
        )}

        {!showCustomerSection && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setAttachCustomer(true)}
          >
            + Attach a customer
          </Button>
        )}

        {showCustomerSection && (
          <div className="flex flex-col gap-4 border-t pt-4">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="borrower">
                {isShortfall
                  ? "Bill the difference to"
                  : isOverpay && overpaymentChoice === "credit"
                    ? "Credit the change to"
                    : "Customer (optional)"}
              </Label>
              {!needsBorrower && (
                <button
                  type="button"
                  onClick={() => {
                    setAttachCustomer(false);
                    resetBorrowerFields();
                  }}
                  className="text-sm text-muted-foreground underline"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Combobox
                id="borrower"
                className="w-full"
                value={borrowerId}
                onValueChange={(v) => setBorrowerId(v || NEW_BORROWER)}
                searchPlaceholder="Search customers…"
                options={[
                  ...borrowers.map((b) => ({
                    value: b.id,
                    label: b.phone ? `${b.name} (${b.phone})` : b.name,
                  })),
                  { value: NEW_BORROWER, label: "+ Add new customer" },
                ]}
              />
            </div>

            {selectedBorrower &&
              (selectedBorrower.totalDue > 0 || (isShortfall && selectedBorrower.creditBalance > 0)) && (
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
                  {selectedBorrower.totalDue > 0 && (
                    <p className="text-muted-foreground">
                      {`${selectedBorrower.name} also has ${formatMoney(selectedBorrower.totalDue, currencySymbol)} outstanding from previous khata bills.`}
                    </p>
                  )}
                  {isShortfall && selectedBorrower.creditBalance > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label htmlFor="use-credit">Use available credit</Label>
                        <p className="text-muted-foreground">
                          {`${formatMoney(selectedBorrower.creditBalance, currencySymbol)} available — confirm with the customer.`}
                        </p>
                      </div>
                      <Switch id="use-credit" checked={useCredit} onCheckedChange={setUseCredit} />
                    </div>
                  )}
                </div>
              )}

            {borrowerId === NEW_BORROWER && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-borrower-name">Name</Label>
                  <Input
                    id="new-borrower-name"
                    value={newBorrowerName}
                    onChange={(e) => setNewBorrowerName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-borrower-phone">Phone (optional)</Label>
                  <Input
                    id="new-borrower-phone"
                    value={newBorrowerPhone}
                    onChange={(e) => setNewBorrowerPhone(e.target.value)}
                  />
                </div>
              </>
            )}

            <p className="text-sm text-muted-foreground">
              {isShortfall
                ? creditApplied > 0
                  ? `${formatMoney(creditApplied, currencySymbol)} of the customer's credit will be applied — ${remainingShortfall > 0 ? `${formatMoney(remainingShortfall, currencySymbol)} will be marked unpaid until settled from the Khata page.` : "this fully covers the shortfall."}`
                  : "The shortfall will be marked unpaid until settled from the Khata page."
                : isOverpay && overpaymentChoice === "credit"
                  ? `${formatMoney(overpayCents, currencySymbol)} will be added to the customer's credit balance instead of being handed back.`
                  : "This sale will be recorded under the selected customer."}
            </p>
          </div>
        )}
      </form>
    </Modal>
  );
}
