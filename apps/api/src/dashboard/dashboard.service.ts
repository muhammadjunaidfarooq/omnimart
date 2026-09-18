import { Injectable } from '@nestjs/common';
import { AccountingService } from '../accounting/accounting.service';
import { DayClosingService } from '../day-closing/day-closing.service';
import { InventoryService } from '../inventory/inventory.service';
import { SalesService } from '../sales/sales.service';
import { ServiceTransactionsService } from '../service-transactions/service-transactions.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly accountingService: AccountingService,
    private readonly dayClosingService: DayClosingService,
    private readonly inventoryService: InventoryService,
    private readonly salesService: SalesService,
    private readonly serviceTransactionsService: ServiceTransactionsService,
  ) {}

  async getKpis(query: DashboardQueryDto) {
    const today = todayIsoDate();
    // Untouched filter bar keeps the original "today" default; any custom
    // range (even a partial one) overrides it, same as every other
    // date-scoped report method already behaves.
    const hasCustomRange = Boolean(query.from || query.to);
    const from = hasCustomRange ? query.from : today;
    const to = hasCustomRange ? query.to : today;
    const filters = {
      paymentMethod: query.paymentMethod,
      cashierId: query.cashierId,
    };

    const [pnl, cash, inventory, inventorySpend] = await Promise.all([
      this.accountingService.getPnl({ from, to, ...filters }),
      this.accountingService.getDailyCashSummary({ from, to, ...filters }),
      this.inventoryService.getSummary(),
      this.dayClosingService.getInventorySpendTotal({ from, to }),
    ]);

    return {
      // Gross, before refunds — see AccountingService.getPnl's sales.total.
      salesTotal: pnl.sales.total,
      refundsTotal: pnl.refunds.total,
      // salesTotal - refundsTotal — see AccountingService.getPnl's netRevenue.
      netSales: pnl.netRevenue,
      // Only the fee portion — see AccountingService.getPnl.
      serviceRevenue: pnl.services.total,
      grossProfit: pnl.grossProfit,
      expenses: pnl.expenses.total,
      netProfit: pnl.netProfit,
      // Cash sales net of refunds and shop expenses (getDailyCashSummary's
      // netCash also folds in cash withdrawals — see AccountingService).
      cashInHand: cash.netCash,
      // A running prediction, not just today's closed-out figure: it nets
      // out whatever inventory spend has been recorded for the range so far
      // (0 before any day in range is closed) against live cash-in-hand, so
      // it keeps moving with new sales even after the day is closed. This is
      // the actual physical cash remaining after every cash inflow/outflow.
      netCashInHand: cash.netCash - inventorySpend,
      onlineTransferTotal: cash.netTransfer,
      inventoryValue: inventory.totalStockValue,
      lowStockCount: inventory.lowStockCount,
      outOfStockCount: inventory.outOfStockCount,
    };
  }

  async getRecentSales(
    user: AuthenticatedUser,
    query: DashboardQueryDto,
    limit = 5,
  ) {
    const { items } = await this.salesService.findHistory(
      {
        page: 1,
        pageSize: limit,
        from: query.from,
        to: query.to,
        paymentMethod: query.paymentMethod,
        cashierId: query.cashierId,
      },
      user,
    );
    return items;
  }

  /** Powers the same "Recent Sales" widget's Services view — see RecentSalesWidget's toggle. */
  async getRecentServiceTransactions(
    user: AuthenticatedUser,
    query: DashboardQueryDto,
    limit = 5,
  ) {
    const { items } = await this.serviceTransactionsService.findAll(
      {
        page: 1,
        pageSize: limit,
        from: query.from,
        to: query.to,
        cashierId: query.cashierId,
      },
      user,
    );
    return items;
  }
}
