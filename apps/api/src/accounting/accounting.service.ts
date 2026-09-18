import { Injectable } from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  SaleStatus,
  ServiceDirection,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  currentMonthRange,
  enumerateDays,
  enumerateMonths,
  endOfDayExclusive,
  lastNDaysRange,
  lastNMonthsRange,
  resolveDateRange,
} from '../common/utils/date-range.util';
import { toNumber } from '../common/utils/decimal.util';
import { saleFilterFields } from '../common/utils/sale-filter.util';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { DailySummaryQueryDto } from './dto/daily-summary-query.dto';

interface DateRange {
  from?: Date;
  to?: Date;
}

function dateFilter(range: DateRange): Prisma.DateTimeFilter | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    ...(range.from ? { gte: range.from } : {}),
    ...(range.to ? { lt: range.to } : {}),
  };
}

/** Same paymentMethod/cashierId shape as saleFilterFields, for ServiceTransaction's where clause. */
function serviceTransactionFilterFields(query: {
  paymentMethod?: PaymentMethod;
  cashierId?: string;
}): Prisma.ServiceTransactionWhereInput {
  return {
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(query.cashierId ? { cashierId: query.cashierId } : {}),
  };
}

interface SaleItemCogsInput {
  quantity: Prisma.Decimal | number;
  product: { costPrice: number };
  refundItems: { quantity: Prisma.Decimal | number }[];
  batchConsumptions: {
    quantity: Prisma.Decimal | number;
    batch: { costPrice: number };
  }[];
}

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A sale item's COGS contribution: net quantity (after refunds) at the
   * weighted-average cost of the batch(es) it actually drew from
   * (SaleItemBatch), not the product's current — possibly since-changed —
   * cost price. Falls back to the product's current cost for sale items
   * that predate batch tracking (no SaleItemBatch rows).
   */
  private computeSaleItemCogs(item: SaleItemCogsInput): number {
    const refundedQuantity = item.refundItems.reduce(
      (sum, r) => sum + toNumber(r.quantity),
      0,
    );
    const netQuantity = toNumber(item.quantity) - refundedQuantity;
    if (netQuantity <= 0) return 0;

    if (item.batchConsumptions.length === 0) {
      return netQuantity * item.product.costPrice;
    }

    const consumedQuantity = item.batchConsumptions.reduce(
      (sum, c) => sum + toNumber(c.quantity),
      0,
    );
    const consumedCost = item.batchConsumptions.reduce(
      (sum, c) => sum + toNumber(c.quantity) * c.batch.costPrice,
      0,
    );
    const weightedCostPrice =
      consumedQuantity > 0
        ? consumedCost / consumedQuantity
        : item.product.costPrice;

    return netQuantity * weightedCostPrice;
  }

  async getPnl(query: DateRangeQueryDto) {
    const range =
      query.from || query.to
        ? resolveDateRange(query.from, query.to)
        : currentMonthRange();
    const completedAt = dateFilter(range);

    const saleFilter = saleFilterFields(query);
    const saleWhere: Prisma.SaleWhereInput = {
      status: SaleStatus.COMPLETED,
      ...(completedAt ? { completedAt } : {}),
      ...saleFilter,
    };

    const serviceWhere: Prisma.ServiceTransactionWhereInput = {
      ...(completedAt ? { createdAt: completedAt } : {}),
      ...serviceTransactionFilterFields(query),
    };

    const [
      salesByMethod,
      refunds,
      saleItems,
      expensesByCategory,
      serviceFeeAgg,
    ] = await Promise.all([
      this.prisma.sale.groupBy({
        by: ['paymentMethod'],
        where: saleWhere,
        _sum: { totalAmount: true },
      }),
      this.prisma.refund.findMany({
        where: {
          ...(range.from || range.to ? { createdAt: dateFilter(range) } : {}),
          ...(Object.keys(saleFilter).length ? { sale: saleFilter } : {}),
        },
        select: {
          totalAmount: true,
          sale: { select: { paymentMethod: true } },
        },
      }),
      this.prisma.saleItem.findMany({
        where: { sale: saleWhere },
        select: {
          quantity: true,
          product: { select: { costPrice: true } },
          refundItems: { select: { quantity: true } },
          batchConsumptions: {
            select: {
              quantity: true,
              batch: { select: { costPrice: true } },
            },
          },
        },
      }),
      this.prisma.expense.groupBy({
        by: ['category'],
        where: range.from || range.to ? { date: dateFilter(range) } : {},
        _sum: { amount: true },
      }),
      // Only the fee is store revenue — billAmount is collected on the
      // utility's behalf and passes straight through, so it never enters
      // profit (unlike the cash-drawer view in getDailyCashSummary, which
      // counts the full amount collected).
      this.prisma.serviceTransaction.aggregate({
        where: serviceWhere,
        _sum: { serviceFee: true },
      }),
    ]);

    const salesCash = sumByPaymentMethod(salesByMethod, PaymentMethod.CASH);
    const salesTransfer = sumByPaymentMethod(
      salesByMethod,
      PaymentMethod.TRANSFER,
    );
    // Khata (credit) sales count toward revenue as soon as the sale completes,
    // matching COGS below (recognized at sale time regardless of payment
    // method) — the daily cash summary, not this P&L, is where "money not
    // actually collected yet" is tracked separately. SPLIT sales are folded
    // in here too, since part of their total is likewise still outstanding.
    const salesCredit =
      sumByPaymentMethod(salesByMethod, PaymentMethod.CREDIT) +
      sumByPaymentMethod(salesByMethod, PaymentMethod.SPLIT);
    const salesTotal = salesCash + salesTransfer + salesCredit;

    const isCreditLikeMethod = (method: PaymentMethod | null) =>
      method === PaymentMethod.CREDIT || method === PaymentMethod.SPLIT;

    const refundsCash = refunds
      .filter((r) => r.sale.paymentMethod === PaymentMethod.CASH)
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const refundsTransfer = refunds
      .filter((r) => r.sale.paymentMethod === PaymentMethod.TRANSFER)
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const refundsCredit = refunds
      .filter((r) => isCreditLikeMethod(r.sale.paymentMethod))
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const refundsTotal = refundsCash + refundsTransfer + refundsCredit;

    const netRevenue = salesTotal - refundsTotal;

    // Net quantity sold (after refunds) at each sale item's actual batch
    // cost — see computeSaleItemCogs.
    const cogs = saleItems.reduce(
      (sum, item) => sum + this.computeSaleItemCogs(item),
      0,
    );

    // Service fee revenue has no COGS — it's pure margin, so it folds
    // straight into gross profit alongside product margin.
    const serviceRevenue = serviceFeeAgg._sum.serviceFee ?? 0;
    const grossProfit = netRevenue - cogs + serviceRevenue;

    const expensesTotal = expensesByCategory.reduce(
      (sum, c) => sum + (c._sum.amount ?? 0),
      0,
    );
    const netProfit = grossProfit - expensesTotal;

    return {
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
      services: {
        total: serviceRevenue,
      },
      sales: {
        cash: salesCash,
        transfer: salesTransfer,
        credit: salesCredit,
        total: salesTotal,
      },
      refunds: {
        cash: refundsCash,
        transfer: refundsTransfer,
        credit: refundsCredit,
        total: refundsTotal,
      },
      netRevenue,
      cogs,
      grossProfit,
      expenses: {
        total: expensesTotal,
        byCategory: expensesByCategory.map((c) => ({
          category: c.category,
          total: c._sum.amount ?? 0,
        })),
      },
      netProfit,
    };
  }

  /**
   * Defaults to a single day (query.date, or today) — the `/admin/expenses`
   * Daily Cash Summary tab's original use — but also accepts a `from`/`to`
   * range instead, which is what lets the dashboard's Cash in
   * Hand/Online Transfer KPI tiles reflect an arbitrary custom window.
   */
  async getDailyCashSummary(query: DailySummaryQueryDto) {
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    const range: DateRange =
      query.from || query.to
        ? resolveDateRange(query.from, query.to)
        : { from: new Date(date), to: endOfDayExclusive(date) };
    const completedAt = dateFilter(range);

    const saleFilter = saleFilterFields(query);
    const saleWhere: Prisma.SaleWhereInput = {
      status: SaleStatus.COMPLETED,
      ...(completedAt ? { completedAt } : {}),
      ...saleFilter,
    };

    // A payment-method filter narrowed to something other than SPLIT means
    // the caller explicitly doesn't want split-sale figures mixed in.
    const includeSplitCash =
      !query.paymentMethod || query.paymentMethod === PaymentMethod.SPLIT;

    const serviceWhere: Prisma.ServiceTransactionWhereInput = {
      ...(completedAt ? { createdAt: completedAt } : {}),
      ...serviceTransactionFilterFields(query),
    };

    // A khata payment's own date (createdAt) — when the money was actually
    // collected — not the original sale's date, and receivedById rather
    // than cashierId for the same cashier filter. CREDIT-method rows (paid
    // from a borrower's existing store credit — see KhataService.
    // payFromCredit) are deliberately excluded: that credit was already
    // counted as cash/transfer when it was originally banked, so including
    // it again here would double-count it. A paymentMethod filter of
    // CREDIT/SPLIT means "show me credit sales", not "show me khata
    // collections" — khataPaymentMethods returns an empty set for those so
    // this query correctly contributes nothing rather than ignoring the
    // filter.
    const khataPaymentWhere: Prisma.KhataPaymentWhereInput = {
      method: { in: khataPaymentMethods(query.paymentMethod) },
      ...(completedAt ? { createdAt: completedAt } : {}),
      ...(query.cashierId ? { receivedById: query.cashierId } : {}),
    };

    const [
      salesByMethod,
      splitCashAgg,
      refunds,
      expenseAgg,
      serviceTransactions,
      khataPaymentsByMethod,
    ] = await Promise.all([
      this.prisma.sale.groupBy({
        by: ['paymentMethod'],
        where: saleWhere,
        _sum: { totalAmount: true },
      }),
      // SPLIT sales only put their cash portion (cashTendered) in the
      // drawer that day — the rest is still outstanding as khata.
      this.prisma.sale.aggregate({
        where: { ...saleWhere, paymentMethod: PaymentMethod.SPLIT },
        _sum: { cashTendered: true },
      }),
      this.prisma.refund.findMany({
        where: {
          ...(completedAt ? { createdAt: completedAt } : {}),
          ...(Object.keys(saleFilter).length ? { sale: saleFilter } : {}),
        },
        select: {
          totalAmount: true,
          sale: { select: { paymentMethod: true } },
        },
      }),
      this.prisma.expense.aggregate({
        where: completedAt ? { date: completedAt } : {},
        _sum: { amount: true },
      }),
      // Fetched per-row (not grouped) since classifying a transaction needs
      // its (snapshotted) direction, not just its paymentMethod — a
      // CASH_WITHDRAWAL transaction is a cash outflow regardless of the
      // TRANSFER paymentMethod recorded on it (see
      // ServiceTransactionsService.buildCashFlowData).
      this.prisma.serviceTransaction.findMany({
        where: serviceWhere,
        select: {
          totalAmount: true,
          paymentMethod: true,
          direction: true,
        },
      }),
      // A borrower settling an old bill today — in cash or by transfer —
      // puts real money in the drawer/bank today, regardless of when the
      // original (khata) sale happened. Without this, that money never
      // showed up in Cash in Hand/Online Transfer at all: the sale itself
      // was booked as CREDIT (excluded from both), and the collection was
      // never looked at here.
      this.prisma.khataPayment.groupBy({
        by: ['method'],
        where: khataPaymentWhere,
        _sum: { amount: true },
      }),
    ]);

    // Unlike getPnl, the full amount collected (bill + fee) counts here for
    // an ordinary bill payment — this is a cash-drawer view of money
    // physically on hand, and the whole amount really is sitting in the
    // drawer even though the bill portion will later be paid out.
    // CASH_DEPOSIT transactions count the same way (cash physically
    // received) but are also tallied separately below for the Close
    // Day/dashboard "deposits" breakdown line. CASH_WITHDRAWAL is the only
    // direction that's a cash outflow rather than inflow.
    let serviceCashIn = 0;
    let serviceTransferIn = 0;
    let serviceCashOut = 0;
    let serviceDeposits = 0;
    for (const t of serviceTransactions) {
      if (t.direction === ServiceDirection.CASH_WITHDRAWAL) {
        serviceCashOut += t.totalAmount;
      } else if (t.direction === ServiceDirection.CASH_DEPOSIT) {
        serviceCashIn += t.totalAmount;
        serviceDeposits += t.totalAmount;
      } else if (t.paymentMethod === PaymentMethod.CASH) {
        serviceCashIn += t.totalAmount;
      } else if (t.paymentMethod === PaymentMethod.TRANSFER) {
        serviceTransferIn += t.totalAmount;
      }
    }

    const khataCashIn = sumKhataByMethod(
      khataPaymentsByMethod,
      PaymentMethod.CASH,
    );
    const khataTransferIn = sumKhataByMethod(
      khataPaymentsByMethod,
      PaymentMethod.TRANSFER,
    );

    const cashSales =
      sumByPaymentMethod(salesByMethod, PaymentMethod.CASH) +
      (includeSplitCash ? (splitCashAgg._sum.cashTendered ?? 0) : 0) +
      serviceCashIn +
      khataCashIn;
    const transferSales =
      sumByPaymentMethod(salesByMethod, PaymentMethod.TRANSFER) +
      serviceTransferIn +
      khataTransferIn;
    const cashRefunds = refunds
      .filter((r) => r.sale.paymentMethod === PaymentMethod.CASH)
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const transferRefunds = refunds
      .filter((r) => r.sale.paymentMethod === PaymentMethod.TRANSFER)
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const expenses = expenseAgg._sum.amount ?? 0;
    const cashWithdrawals = serviceCashOut;
    // A subset of cashSales above, not an additional term — see the loop
    // that builds serviceCashIn/serviceDeposits together.
    const cashDeposits = serviceDeposits;

    // Cash left from sales before shop expenses are paid out of the drawer —
    // what Close Day calls "Cash Remaining from Sales" once inventory spend
    // is deducted from it too.
    const netCashBeforeExpenses = cashSales - cashRefunds - cashWithdrawals;

    return {
      date:
        query.date ??
        query.from ??
        range.from?.toISOString().slice(0, 10) ??
        date,
      cashSales,
      cashRefunds,
      cashWithdrawals,
      cashDeposits,
      // Subsets of cashSales/transferSales above, not additional terms —
      // khata (credit) collections received in this range, broken out for
      // visibility into how much of today's cash came from old bills rather
      // than same-day sales/services.
      khataCashIn,
      khataTransferIn,
      transferSales,
      transferRefunds,
      expenses,
      netCashBeforeExpenses,
      netCash: netCashBeforeExpenses - expenses,
      netTransfer: transferSales - transferRefunds,
    };
  }

  /**
   * Monthly P&L trend — powers both the profit-vs-expense chart (default:
   * last 12 months) and the financial report (explicit range). Expense
   * totals are never filtered by paymentMethod/cashierId — store overhead
   * isn't tied to a sale or a cashier.
   */
  async getMonthlyPnl(query: {
    from?: string;
    to?: string;
    paymentMethod?: PaymentMethod;
    cashierId?: string;
  }) {
    const range =
      query.from || query.to
        ? resolveDateRange(query.from, query.to)
        : lastNMonthsRange(12);
    const saleFilter = saleFilterFields(query);
    const saleWhere: Prisma.SaleWhereInput = {
      status: SaleStatus.COMPLETED,
      completedAt: { gte: range.from, lt: range.to },
      ...saleFilter,
    };

    const [sales, refunds, saleItems, expenses, serviceTransactions] =
      await Promise.all([
        this.prisma.sale.findMany({
          where: saleWhere,
          select: { completedAt: true, totalAmount: true },
        }),
        this.prisma.refund.findMany({
          where: {
            createdAt: { gte: range.from, lt: range.to },
            ...(Object.keys(saleFilter).length ? { sale: saleFilter } : {}),
          },
          select: { createdAt: true, totalAmount: true },
        }),
        this.prisma.saleItem.findMany({
          where: { sale: saleWhere },
          select: {
            quantity: true,
            product: { select: { costPrice: true } },
            refundItems: { select: { quantity: true } },
            batchConsumptions: {
              select: {
                quantity: true,
                batch: { select: { costPrice: true } },
              },
            },
            sale: { select: { completedAt: true } },
          },
        }),
        this.prisma.expense.findMany({
          where: { date: { gte: range.from, lt: range.to } },
          select: { date: true, amount: true },
        }),
        // Only the fee is store revenue — see getPnl.
        this.prisma.serviceTransaction.findMany({
          where: {
            createdAt: { gte: range.from, lt: range.to },
            ...serviceTransactionFilterFields(query),
          },
          select: { createdAt: true, serviceFee: true },
        }),
      ]);

    const months = enumerateMonths(range.from!, range.to!);
    const buckets = new Map(
      months.map((m) => [
        m,
        { revenue: 0, refunds: 0, cogs: 0, expenses: 0, serviceRevenue: 0 },
      ]),
    );

    for (const sale of sales) {
      const bucket = buckets.get(sale.completedAt!.toISOString().slice(0, 7));
      if (bucket) bucket.revenue += sale.totalAmount;
    }
    for (const refund of refunds) {
      const bucket = buckets.get(refund.createdAt.toISOString().slice(0, 7));
      if (bucket) bucket.refunds += refund.totalAmount;
    }
    for (const item of saleItems) {
      const bucket = buckets.get(
        item.sale.completedAt!.toISOString().slice(0, 7),
      );
      if (!bucket) continue;
      bucket.cogs += this.computeSaleItemCogs(item);
    }
    for (const expense of expenses) {
      const bucket = buckets.get(expense.date.toISOString().slice(0, 7));
      if (bucket) bucket.expenses += expense.amount;
    }
    for (const transaction of serviceTransactions) {
      const bucket = buckets.get(
        transaction.createdAt.toISOString().slice(0, 7),
      );
      if (bucket) bucket.serviceRevenue += transaction.serviceFee;
    }

    return months.map((month) => {
      const bucket = buckets.get(month)!;
      const netRevenue = bucket.revenue - bucket.refunds;
      const grossProfit = netRevenue - bucket.cogs + bucket.serviceRevenue;
      const netProfit = grossProfit - bucket.expenses;
      return {
        month,
        revenue: bucket.revenue,
        refunds: bucket.refunds,
        netRevenue,
        cogs: bucket.cogs,
        serviceRevenue: bucket.serviceRevenue,
        grossProfit,
        expenses: bucket.expenses,
        netProfit,
      };
    });
  }

  /** Daily cash-vs-transfer breakdown — the financial report's tabular view (default: last 30 days). */
  async getCashVsTransferDaily(query: { from?: string; to?: string }) {
    const range =
      query.from || query.to
        ? resolveDateRange(query.from, query.to)
        : lastNDaysRange(30);

    const [sales, refunds, khataPayments] = await Promise.all([
      this.prisma.sale.findMany({
        where: {
          status: SaleStatus.COMPLETED,
          completedAt: { gte: range.from, lt: range.to },
        },
        select: {
          completedAt: true,
          totalAmount: true,
          paymentMethod: true,
          cashTendered: true,
        },
      }),
      this.prisma.refund.findMany({
        where: { createdAt: { gte: range.from, lt: range.to } },
        select: {
          createdAt: true,
          totalAmount: true,
          sale: { select: { paymentMethod: true } },
        },
      }),
      // A borrower settling an old bill lands in the day it's actually
      // collected, not the day of the original (khata) sale — see
      // getDailyCashSummary, whose per-day breakdown this trend must agree
      // with. CREDIT-method rows (paid from store credit) are excluded, same
      // reasoning as there.
      this.prisma.khataPayment.findMany({
        where: {
          createdAt: { gte: range.from, lt: range.to },
          method: { in: [PaymentMethod.CASH, PaymentMethod.TRANSFER] },
        },
        select: { createdAt: true, amount: true, method: true },
      }),
    ]);

    const days = enumerateDays(range.from!, range.to!);
    const buckets = new Map(
      days.map((d) => [
        d,
        { cashSales: 0, transferSales: 0, cashRefunds: 0, transferRefunds: 0 },
      ]),
    );

    for (const sale of sales) {
      const bucket = buckets.get(sale.completedAt!.toISOString().slice(0, 10));
      if (!bucket) continue;
      if (sale.paymentMethod === PaymentMethod.CASH)
        bucket.cashSales += sale.totalAmount;
      else if (sale.paymentMethod === PaymentMethod.TRANSFER)
        bucket.transferSales += sale.totalAmount;
      // Only the cash portion of a SPLIT sale (cashTendered) hit the drawer —
      // the rest is still outstanding as khata.
      else if (sale.paymentMethod === PaymentMethod.SPLIT)
        bucket.cashSales += sale.cashTendered ?? 0;
    }
    for (const refund of refunds) {
      const bucket = buckets.get(refund.createdAt.toISOString().slice(0, 10));
      if (!bucket) continue;
      if (refund.sale.paymentMethod === PaymentMethod.CASH)
        bucket.cashRefunds += refund.totalAmount;
      else if (refund.sale.paymentMethod === PaymentMethod.TRANSFER)
        bucket.transferRefunds += refund.totalAmount;
    }
    for (const payment of khataPayments) {
      const bucket = buckets.get(payment.createdAt.toISOString().slice(0, 10));
      if (!bucket) continue;
      if (payment.method === PaymentMethod.CASH)
        bucket.cashSales += payment.amount;
      else if (payment.method === PaymentMethod.TRANSFER)
        bucket.transferSales += payment.amount;
    }

    return days.map((date) => {
      const bucket = buckets.get(date)!;
      return {
        date,
        ...bucket,
        netCash: bucket.cashSales - bucket.cashRefunds,
        netTransfer: bucket.transferSales - bucket.transferRefunds,
      };
    });
  }
}

function sumByPaymentMethod(
  rows: {
    paymentMethod: PaymentMethod | null;
    _sum: { totalAmount: number | null };
  }[],
  method: PaymentMethod,
): number {
  return rows.find((r) => r.paymentMethod === method)?._sum.totalAmount ?? 0;
}

function sumKhataByMethod(
  rows: { method: PaymentMethod; _sum: { amount: number | null } }[],
  method: PaymentMethod,
): number {
  return rows.find((r) => r.method === method)?._sum.amount ?? 0;
}

/**
 * Which KhataPayment.method values count as a cash/transfer collection for
 * a given Sale-style paymentMethod filter. CREDIT/SPLIT means "show me
 * credit sales", not "show me khata collections" — a settlement is never
 * SPLIT, and a CREDIT settlement (paid from store credit) was already
 * counted as cash/transfer when that credit was originally banked — so both
 * correctly contribute nothing here rather than the filter being ignored.
 */
function khataPaymentMethods(paymentMethod?: PaymentMethod): PaymentMethod[] {
  if (!paymentMethod) return [PaymentMethod.CASH, PaymentMethod.TRANSFER];
  return paymentMethod === PaymentMethod.CASH ||
    paymentMethod === PaymentMethod.TRANSFER
    ? [paymentMethod]
    : [];
}
