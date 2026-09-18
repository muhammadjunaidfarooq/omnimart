import { API_URL, type Sale } from "./sales";

export interface Borrower {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  unpaidBillCount: number;
  /** Cents outstanding across all of this borrower's non-PAID sales */
  totalDue: number;
  /** Cents the store owes this borrower from a past khata overpayment — auto-applied to their next credit purchase */
  creditBalance: number;
}

/** Cashier-facing payment methods for settling a khata bill — matches CheckoutDialog's Method type. Only these two are ever chosen from the form; SPLIT doesn't apply to a settlement. */
export type KhataPaymentMethod = "CASH" | "TRANSFER";

/** How a recorded KhataPayment was actually settled — adds CREDIT (paid from the borrower's existing store credit, via payFromCredit) to the form's two choices, since that's a real outcome the server can return even though a cashier never picks it directly. */
export type KhataPaymentRecordMethod = KhataPaymentMethod | "CREDIT";

export interface KhataPayment {
  id: string;
  saleId: string;
  amount: number;
  /** How this payment was actually received. Pre-existing rows recorded before this field existed default to CASH server-side. */
  method: KhataPaymentRecordMethod;
  transferReference: string | null;
  receivedById: string;
  receivedBy: { id: string; name: string };
  note: string | null;
  createdAt: string;
}

/** A khata payment with the invoice it was applied to — the flat, borrower-wide payment history. */
export interface BorrowerPayment extends KhataPayment {
  invoiceNumber: string;
}

export interface BorrowerBill extends Sale {
  /** totalAmount - amountPaid - refundedAmount, in cents (never negative) */
  amountDue: number;
  /** Sum of this bill's refunds, in cents */
  refundedAmount: number;
  khataPayments: KhataPayment[];
}

export interface BorrowerBillsParams {
  from?: string;
  to?: string;
}

export type LedgerEntryType = "PURCHASE" | "PAYMENT" | "REFUND";

/** One line of a borrower's statement — a purchase (debit), payment, or refund (both credits). */
export interface LedgerEntry {
  date: string;
  type: LedgerEntryType;
  invoiceNumber: string;
  saleId: string;
  description: string;
  debit: number;
  credit: number;
  /** Running balance after this entry, starting from the statement's openingBalance */
  balance: number;
}

export interface BorrowerStatement {
  id: string;
  name: string;
  phone: string | null;
  creditBalance: number;
  /** This borrower's current outstanding balance across their entire history — unaffected by the date range */
  totalDue: number;
  /** What the borrower already owed coming into the requested range (0 when no `from` is given) */
  openingBalance: number;
  /** openingBalance plus every debit/credit in the range — the balance as of `to` (or now, if `to` is omitted) */
  closingBalance: number;
  ledger: LedgerEntry[];
}

export interface BorrowerDetail {
  id: string;
  name: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  /** Cents the store owes this borrower from a past khata overpayment — auto-applied to their next credit purchase */
  creditBalance: number;
  /** Bills within the requested date range (all of them, when no range is given) */
  sales: BorrowerBill[];
  /** Payments within the requested date range, across all of this borrower's bills */
  payments: BorrowerPayment[];
  summary: {
    /** Sum of totalAmount for bills in the requested range */
    totalBilled: number;
    /** Sum of payments received in the requested range */
    totalPaid: number;
    /** This borrower's current outstanding balance across their entire history — unaffected by the date range */
    totalDue: number;
  };
}

async function parseErrorMessage(res: Response, fallback: string) {
  const err = await res.json().catch(() => ({}));
  const message = (err as { message?: string | string[] }).message;
  return Array.isArray(message) ? message.join(", ") : message ?? fallback;
}

export const khataKeys = {
  all: ["khata"] as const,
  borrowers: (search?: string) => ["khata", "borrowers", search ?? ""] as const,
  borrower: (id: string, params: BorrowerBillsParams = {}) =>
    ["khata", "borrowers", id, params] as const,
};

export async function fetchBorrowers(search?: string): Promise<Borrower[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`${API_URL}/khata/borrowers${query}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch borrowers");
  return res.json();
}

export async function fetchBorrowerBills(
  borrowerId: string,
  params: BorrowerBillsParams = {},
): Promise<BorrowerDetail> {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);

  const res = await fetch(`${API_URL}/khata/borrowers/${borrowerId}?${query}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch borrower's bills");
  return res.json();
}

export async function recordKhataPayment(
  saleId: string,
  amount: number,
  paymentMethod: KhataPaymentMethod,
  transferReference?: string,
  note?: string,
): Promise<Sale & { creditAdded: number }> {
  const res = await fetch(`${API_URL}/khata/sales/${saleId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      amount,
      paymentMethod,
      transferReference: transferReference || undefined,
      note: note || undefined,
    }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not record payment"));
  return res.json();
}

export async function payAllOutstanding(
  borrowerId: string,
  paymentMethod: KhataPaymentMethod,
  amount?: number,
  transferReference?: string,
): Promise<{ settledBillCount: number; totalSettled: number; creditAdded: number }> {
  const res = await fetch(`${API_URL}/khata/borrowers/${borrowerId}/pay-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ amount, paymentMethod, transferReference: transferReference || undefined }),
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not settle khata"));
  return res.json();
}

/** Settles a borrower's outstanding bills using their existing store credit balance instead of a new payment. */
export async function payFromCredit(
  borrowerId: string,
): Promise<{ settledBillCount: number; totalSettled: number; remainingDue: number }> {
  const res = await fetch(`${API_URL}/khata/borrowers/${borrowerId}/pay-from-credit`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await parseErrorMessage(res, "Could not apply credit"));
  return res.json();
}
