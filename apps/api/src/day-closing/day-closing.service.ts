import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountingService } from '../accounting/accounting.service';
import { PrismaService } from '../prisma/prisma.service';
import { resolveDateRange } from '../common/utils/date-range.util';
import { CloseDayDto } from './dto/close-day.dto';
import { DayClosingQueryDto } from './dto/day-closing-query.dto';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateWhere(range: {
  from?: Date;
  to?: Date;
}): Prisma.DayClosingWhereInput {
  if (!range.from && !range.to) return {};
  return {
    date: {
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lt: range.to } : {}),
    },
  };
}

@Injectable()
export class DayClosingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
  ) {}

  /**
   * Fresh totals for a day, plus its existing closing record if the day has
   * already been closed — lets the admin see what re-closing would overwrite.
   */
  async getPreview(date?: string) {
    const resolvedDate = date ?? todayIsoDate();
    const [pnl, cashSummary, existing] = await Promise.all([
      this.accountingService.getPnl({ from: resolvedDate, to: resolvedDate }),
      this.accountingService.getDailyCashSummary({ date: resolvedDate }),
      this.prisma.dayClosing.findUnique({
        where: { date: new Date(resolvedDate) },
        include: { closedBy: { select: { id: true, name: true } } },
      }),
    ]);

    return {
      date: resolvedDate,
      totalSales: pnl.sales.total,
      // Raw components, so the UI can show a non-double-counting waterfall
      // down to cashFromSales rather than displaying cashWithdrawals/
      // cashDeposits a second time alongside the already-net figure.
      cashSales: cashSummary.cashSales,
      cashRefunds: cashSummary.cashRefunds,
      cashWithdrawals: cashSummary.cashWithdrawals,
      cashDeposits: cashSummary.cashDeposits,
      // Cash sales net of refunds, withdrawals, and deposits, before
      // inventory/expense deductions — the admin's cashUsedForInventory
      // input (live in the form) and the expenses figure below combine with
      // this client-side to preview cashRemainingFromSales/netCashInHand
      // before submitting.
      cashFromSales: cashSummary.netCashBeforeExpenses,
      expenses: cashSummary.expenses,
      closing: existing,
    };
  }

  /**
   * Closes (or re-closes) the register for a day: snapshots that day's total
   * sales and cash flow fresh, records the admin-entered inventory spend,
   * and derives cashRemainingFromSales/netCashInHand. Re-closing the same
   * date overwrites its previous record.
   */
  async closeDay(dto: CloseDayDto, userId: string) {
    const date = dto.date ?? todayIsoDate();
    const [pnl, cashSummary] = await Promise.all([
      this.accountingService.getPnl({ from: date, to: date }),
      this.accountingService.getDailyCashSummary({ date }),
    ]);

    const totalSales = pnl.sales.total;
    const cashFromSales = cashSummary.netCashBeforeExpenses;
    const cashWithdrawals = cashSummary.cashWithdrawals;
    const cashDeposits = cashSummary.cashDeposits;
    const expenses = cashSummary.expenses;
    // Sales-driven cash left before shop expenses — feeds net-profit-adjacent
    // reporting rather than the actual cash-in-drawer figure below it.
    const cashRemainingFromSales = cashFromSales - dto.cashUsedForInventory;
    // The actual physical cash left in the drawer once expenses are also
    // paid out of it.
    const netCashInHand = cashRemainingFromSales - expenses;

    const data = {
      totalSales,
      cashFromSales,
      cashWithdrawals,
      cashDeposits,
      expenses,
      cashUsedForInventory: dto.cashUsedForInventory,
      cashRemainingFromSales,
      netCashInHand,
      note: dto.note,
      closedById: userId,
    };

    return this.prisma.dayClosing.upsert({
      where: { date: new Date(date) },
      create: { date: new Date(date), ...data },
      update: { ...data, closedAt: new Date() },
      include: { closedBy: { select: { id: true, name: true } } },
    });
  }

  async findAll(query: DayClosingQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = dateWhere(resolveDateRange(query.from, query.to));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.dayClosing.findMany({
        where,
        include: { closedBy: { select: { id: true, name: true } } },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.dayClosing.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Sum of cashUsedForInventory across every day closed within a range — the
   * dashboard's "Net Cash in Hand" tile subtracts this from live cash-in-hand
   * (which already nets out withdrawals/deposits/expenses — see
   * AccountingService.getDailyCashSummary) so the figure stays a running
   * prediction: it already reflects today's closing (if the day has been
   * closed) and moves with new sales recorded after that, or reads as plain
   * cash-in-hand (nothing spent on inventory yet) before the day is closed.
   */
  async getInventorySpendTotal(query: {
    from?: string;
    to?: string;
  }): Promise<number> {
    const where = dateWhere(resolveDateRange(query.from, query.to));
    const agg = await this.prisma.dayClosing.aggregate({
      where,
      _sum: { cashUsedForInventory: true },
    });
    return agg._sum.cashUsedForInventory ?? 0;
  }
}
