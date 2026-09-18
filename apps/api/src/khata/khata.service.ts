import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma, Sale } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveDateRange } from '../common/utils/date-range.util';
import { BorrowerBillsQueryDto } from './dto/borrower-bills-query.dto';
import { BorrowerQueryDto } from './dto/borrower-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

/** Payment methods that can leave a borrower owing money via khata. */
const CREDIT_PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.CREDIT,
  PaymentMethod.SPLIT,
];

type SaleWithRefunds = Sale & { refunds: { totalAmount: number }[] };

/** A sale's remaining khata balance — total charged, minus what's already been paid, minus anything refunded against it. Never negative (a partial refund can't leave a bill "owing" less than zero). */
function amountDue(sale: {
  totalAmount: number;
  amountPaid: number;
  refunds: { totalAmount: number }[];
}): number {
  const refunded = sale.refunds.reduce((sum, r) => sum + r.totalAmount, 0);
  return Math.max(0, sale.totalAmount - sale.amountPaid - refunded);
}

/** Whether `date` falls in `[from, to)` — a missing bound on either side leaves that side open. */
function isWithinRange(date: Date, from?: Date, to?: Date): boolean {
  if (from && date < from) return false;
  if (to && date >= to) return false;
  return true;
}

@Injectable()
export class KhataService {
  constructor(private readonly prisma: PrismaService) {}

  /** Borrowers with their aggregate outstanding balance — powers both the checkout borrower picker and the Khata page. */
  async findBorrowers(query: BorrowerQueryDto) {
    const where: Prisma.BorrowerWhereInput = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {};

    const borrowers = await this.prisma.borrower.findMany({
      where,
      include: {
        sales: {
          where: { paymentStatus: { not: PaymentStatus.PAID } },
          select: {
            totalAmount: true,
            amountPaid: true,
            refunds: { select: { totalAmount: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return borrowers.map(({ sales, ...borrower }) => {
      // A sale can be UNPAID/PARTIALLY_PAID by paymentStatus alone yet have
      // nothing left owed once its refunds are accounted for — that's not
      // an outstanding bill any more.
      const outstanding = sales.filter((sale) => amountDue(sale) > 0);
      return {
        ...borrower,
        unpaidBillCount: outstanding.length,
        totalDue: outstanding.reduce((sum, sale) => sum + amountDue(sale), 0),
      };
    });
  }

  /**
   * The borrower plus every credit bill ever raised against them — each with
   * its full refund history attached (not just the summed refundedAmount),
   * since both findBorrowerBills and getStatement need to slice that history
   * by date differently. Shared so the borrower/sales fetch and the
   * amountDue/refundedAmount math happen in exactly one place.
   */
  private async loadBorrowerHistory(borrowerId: string) {
    const borrower = await this.prisma.borrower.findUnique({
      where: { id: borrowerId },
      include: {
        sales: {
          where: { paymentMethod: { in: CREDIT_PAYMENT_METHODS } },
          include: {
            items: true,
            khataPayments: {
              include: { receivedBy: { select: { id: true, name: true } } },
              orderBy: { createdAt: 'desc' },
            },
            refunds: {
              select: {
                id: true,
                totalAmount: true,
                reason: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!borrower) throw new NotFoundException('Borrower not found');

    const { sales, ...rest } = borrower;
    const bills = sales.map((sale) => ({
      ...sale,
      refundedAmount: sale.refunds.reduce((sum, r) => sum + r.totalAmount, 0),
      amountDue: amountDue(sale),
    }));

    return { borrower: rest, bills };
  }

  /**
   * A borrower's complete khata history — every credit bill ever raised
   * against them (with amountDue/refundedAmount per bill) and every payment
   * ever received, optionally narrowed to a date range. The running
   * `totalDue` always reflects the borrower's full history regardless of the
   * date range — a filter narrows what history is *shown*, not what they
   * currently owe.
   */
  async findBorrowerBills(
    borrowerId: string,
    query: BorrowerBillsQueryDto = {},
  ) {
    const { borrower, bills: allBills } =
      await this.loadBorrowerHistory(borrowerId);
    const totalDue = allBills.reduce((sum, bill) => sum + bill.amountDue, 0);

    const { from, to } = resolveDateRange(query.from, query.to);

    const bills = allBills.filter(
      (bill) =>
        (!from && !to) ||
        (bill.completedAt && isWithinRange(bill.completedAt, from, to)),
    );
    const payments = allBills
      .flatMap((bill) =>
        bill.khataPayments.map((payment) => ({
          ...payment,
          invoiceNumber: bill.invoiceNumber,
          saleId: bill.id,
        })),
      )
      .filter((payment) => isWithinRange(payment.createdAt, from, to))
      .sort((a, b) => +b.createdAt - +a.createdAt);

    return {
      ...borrower,
      sales: bills,
      payments,
      summary: {
        totalBilled: bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
        totalPaid: payments.reduce((sum, payment) => sum + payment.amount, 0),
        totalDue,
      },
    };
  }

  /**
   * A printable customer statement for a date range — the same purchase,
   * payment, and refund history findBorrowerBills exposes, merged into one
   * chronological ledger with a running balance. `openingBalance` is what
   * the borrower already owed coming into the range (0 when `from` is
   * omitted), so a statement for e.g. "last month" still shows where they
   * stood at the start of it, not just what moved during it.
   */
  async getStatement(borrowerId: string, query: BorrowerBillsQueryDto = {}) {
    const { borrower, bills } = await this.loadBorrowerHistory(borrowerId);
    const totalDue = bills.reduce((sum, bill) => sum + bill.amountDue, 0);
    const { from, to } = resolveDateRange(query.from, query.to);

    const entries = bills.flatMap((bill) => {
      const rows: {
        date: Date;
        type: 'PURCHASE' | 'PAYMENT' | 'REFUND';
        invoiceNumber: string;
        saleId: string;
        description: string;
        debit: number;
        credit: number;
      }[] = [];
      if (bill.completedAt) {
        rows.push({
          date: bill.completedAt,
          type: 'PURCHASE',
          invoiceNumber: bill.invoiceNumber,
          saleId: bill.id,
          description: `Purchase — ${bill.invoiceNumber}`,
          debit: bill.totalAmount,
          credit: 0,
        });
      }
      for (const payment of bill.khataPayments) {
        rows.push({
          date: payment.createdAt,
          type: 'PAYMENT',
          invoiceNumber: bill.invoiceNumber,
          saleId: bill.id,
          description: payment.note
            ? `Payment — ${payment.note}`
            : `Payment — ${bill.invoiceNumber}`,
          debit: 0,
          credit: payment.amount,
        });
      }
      for (const refund of bill.refunds) {
        rows.push({
          date: refund.createdAt,
          type: 'REFUND',
          invoiceNumber: bill.invoiceNumber,
          saleId: bill.id,
          description: refund.reason
            ? `Refund — ${refund.reason}`
            : `Refund — ${bill.invoiceNumber}`,
          debit: 0,
          credit: refund.totalAmount,
        });
      }
      return rows;
    });
    entries.sort((a, b) => +a.date - +b.date);

    // Nothing predates "the beginning" — an omitted `from` means the ledger
    // below already starts from the borrower's very first transaction, so
    // there's nothing left to fold into an opening balance.
    const openingBalance = entries
      .filter((entry) => from && entry.date < from)
      .reduce((sum, entry) => sum + entry.debit - entry.credit, 0);

    let runningBalance = openingBalance;
    const ledger = entries
      .filter((entry) => isWithinRange(entry.date, from, to))
      .map((entry) => {
        runningBalance += entry.debit - entry.credit;
        return { ...entry, balance: runningBalance };
      });

    return {
      ...borrower,
      totalDue,
      openingBalance,
      closingBalance: runningBalance,
      ledger,
    };
  }

  /**
   * The only sanctioned way to change Sale.amountPaid for a khata sale.
   * Writes an append-only KhataPayment ledger entry and advances the sale's
   * running amountPaid/paymentStatus in the same transaction — mirrors
   * InventoryService.recordMovement's ledger + denormalized-total pattern.
   * `method` records how the money actually arrived (CASH/TRANSFER for a new
   * payment, CREDIT when settled from the borrower's own store credit — see
   * payFromCredit) so AccountingService.getDailyCashSummary can count it
   * correctly for the day it's received.
   */
  private async settleSale(
    tx: Prisma.TransactionClient,
    sale: Sale,
    amount: number,
    userId: string,
    method: PaymentMethod,
    note?: string,
    transferReference?: string,
  ) {
    const amountPaid = sale.amountPaid + amount;
    const paymentStatus =
      amountPaid >= sale.totalAmount
        ? PaymentStatus.PAID
        : PaymentStatus.PARTIALLY_PAID;

    const updated = await tx.sale.update({
      where: { id: sale.id },
      data: { amountPaid, paymentStatus },
    });

    await tx.khataPayment.create({
      data: {
        saleId: sale.id,
        amount,
        method,
        transferReference,
        receivedById: userId,
        note,
      },
    });

    return updated;
  }

  /**
   * Applies `amount` across `sales` oldest-first, settling each fully before
   * moving to the next. Shared by every "settle these bills with this much
   * money" action — the only difference between them is where the amount
   * and the sales come from, and what happens to any of it left over.
   */
  private async settleAcrossBills(
    tx: Prisma.TransactionClient,
    sales: SaleWithRefunds[],
    userId: string,
    amount: number,
    method: PaymentMethod,
    note: string,
    transferReference?: string,
  ): Promise<{ settledBillCount: number; totalSettled: number }> {
    let remaining = amount;
    let settledBillCount = 0;
    for (const sale of sales) {
      if (remaining <= 0) break;
      const due = amountDue(sale);
      const applyAmount = Math.min(remaining, due);
      await this.settleSale(
        tx,
        sale,
        applyAmount,
        userId,
        method,
        note,
        transferReference,
      );
      remaining -= applyAmount;
      if (applyAmount === due) settledBillCount += 1;
    }
    return { settledBillCount, totalSettled: amount - remaining };
  }

  async recordPayment(saleId: string, dto: RecordPaymentDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { refunds: { select: { totalAmount: true } } },
      });
      if (!sale) throw new NotFoundException('Sale not found');
      if (
        !sale.paymentMethod ||
        !CREDIT_PAYMENT_METHODS.includes(sale.paymentMethod)
      ) {
        throw new BadRequestException('This sale is not a khata/credit sale');
      }
      if (sale.paymentStatus === PaymentStatus.PAID) {
        throw new BadRequestException('This bill is already fully paid');
      }

      // Overpaying this bill settles it and banks the excess as store credit
      // on the borrower, instead of being rejected.
      const due = amountDue(sale);
      if (due <= 0) {
        throw new BadRequestException(
          'This bill has already been fully refunded',
        );
      }
      const amountToBill = Math.min(dto.amount, due);
      const overpaid = dto.amount - amountToBill;

      const updated = await this.settleSale(
        tx,
        sale,
        amountToBill,
        userId,
        dto.paymentMethod,
        dto.note,
        dto.transferReference,
      );
      if (overpaid > 0) {
        await tx.borrower.update({
          where: { id: sale.borrowerId! },
          data: { creditBalance: { increment: overpaid } },
        });
      }

      return { ...updated, creditAdded: overpaid };
    });
  }

  /** A borrower's outstanding khata bills, oldest first, with the sum still owed across them. */
  private async findOutstandingSales(
    tx: Prisma.TransactionClient,
    borrowerId: string,
  ) {
    const sales = await tx.sale.findMany({
      where: {
        borrowerId,
        paymentMethod: { in: CREDIT_PAYMENT_METHODS },
        paymentStatus: { not: PaymentStatus.PAID },
      },
      include: { refunds: { select: { totalAmount: true } } },
      orderBy: { createdAt: 'asc' },
    });
    // Same "paymentStatus alone isn't enough" caveat as findBorrowers — drop
    // anything a refund has already fully covered.
    const outstanding = sales.filter((sale) => amountDue(sale) > 0);
    const totalDue = outstanding.reduce(
      (sum, sale) => sum + amountDue(sale),
      0,
    );
    return { sales: outstanding, totalDue };
  }

  /**
   * Settles a borrower's outstanding bills against a single payment amount —
   * the "pay full khata" action. Omit `amount` (or pass the full total due)
   * to settle everything; a smaller amount is applied oldest-bill-first,
   * partially settling the last bill it touches if it doesn't stretch far
   * enough to cover it in full. Paying more than the total due settles every
   * bill and banks the excess as store credit on the borrower.
   */
  async payAllOutstanding(
    borrowerId: string,
    userId: string,
    method: PaymentMethod,
    amount?: number,
    transferReference?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const borrower = await tx.borrower.findUnique({
        where: { id: borrowerId },
      });
      if (!borrower) throw new NotFoundException('Borrower not found');

      const { sales, totalDue } = await this.findOutstandingSales(
        tx,
        borrowerId,
      );
      if (sales.length === 0) {
        throw new BadRequestException(
          'This borrower has no outstanding khata bills',
        );
      }

      const amountToApply = amount ?? totalDue;
      if (amountToApply <= 0) {
        throw new BadRequestException('Payment amount must be positive');
      }

      const amountToBills = Math.min(amountToApply, totalDue);
      const overpaid = amountToApply - amountToBills;

      const { settledBillCount } = await this.settleAcrossBills(
        tx,
        sales,
        userId,
        amountToBills,
        method,
        'Khata settlement',
        transferReference,
      );

      if (overpaid > 0) {
        await tx.borrower.update({
          where: { id: borrowerId },
          data: { creditBalance: { increment: overpaid } },
        });
      }

      return {
        settledBillCount,
        totalSettled: amountToBills,
        creditAdded: overpaid,
      };
    });
  }

  /**
   * Settles a borrower's outstanding bills using their existing store credit
   * (banked from a past khata overpayment) instead of a new incoming
   * payment — applies as much of the credit as covers the total due,
   * oldest-bill-first, fully paying off khata when the credit stretches far
   * enough to cover it all.
   */
  async payFromCredit(borrowerId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const borrower = await tx.borrower.findUnique({
        where: { id: borrowerId },
      });
      if (!borrower) throw new NotFoundException('Borrower not found');
      if (borrower.creditBalance <= 0) {
        throw new BadRequestException(
          'This borrower has no credit balance available',
        );
      }

      const { sales, totalDue } = await this.findOutstandingSales(
        tx,
        borrowerId,
      );
      if (sales.length === 0) {
        throw new BadRequestException(
          'This borrower has no outstanding khata bills',
        );
      }

      const amountToApply = Math.min(borrower.creditBalance, totalDue);

      // Not a new cash inflow — the credit being spent was already counted
      // as cash/transfer when it was originally banked (see settleOrCredit),
      // so this settlement is tagged CREDIT and excluded from
      // AccountingService.getDailyCashSummary's cash/transfer totals.
      const { settledBillCount } = await this.settleAcrossBills(
        tx,
        sales,
        userId,
        amountToApply,
        PaymentMethod.CREDIT,
        'Paid from store credit',
      );

      await tx.borrower.update({
        where: { id: borrowerId },
        data: { creditBalance: { decrement: amountToApply } },
      });

      return {
        settledBillCount,
        totalSettled: amountToApply,
        remainingDue: totalDue - amountToApply,
      };
    });
  }

  /**
   * Applies a NEW incoming amount for a borrower to their oldest outstanding
   * khata bills first, banking any leftover as store credit. Runs inside the
   * caller's own transaction so it composes atomically with whatever else
   * produced the money — e.g. SalesService.checkout diverting a cash
   * overpayment to a borrower instead of handing back change (the only
   * current caller, hence the CASH default — that path never has any other
   * method, since change only exists on a CASH sale).
   */
  async settleOrCredit(
    tx: Prisma.TransactionClient,
    borrowerId: string,
    userId: string,
    amount: number,
    note: string,
    method: PaymentMethod = PaymentMethod.CASH,
  ): Promise<{
    settledBillCount: number;
    totalSettled: number;
    creditAdded: number;
  }> {
    if (amount <= 0) {
      return { settledBillCount: 0, totalSettled: 0, creditAdded: 0 };
    }

    const { sales, totalDue } = await this.findOutstandingSales(tx, borrowerId);
    const amountToBills = Math.min(amount, totalDue);

    const { settledBillCount } = await this.settleAcrossBills(
      tx,
      sales,
      userId,
      amountToBills,
      method,
      note,
    );

    const creditAdded = amount - amountToBills;
    if (creditAdded > 0) {
      await tx.borrower.update({
        where: { id: borrowerId },
        data: { creditBalance: { increment: creditAdded } },
      });
    }

    return { settledBillCount, totalSettled: amountToBills, creditAdded };
  }
}
