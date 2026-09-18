import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { DayClosingModule } from '../day-closing/day-closing.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SalesModule } from '../sales/sales.module';
import { ServiceTransactionsModule } from '../service-transactions/service-transactions.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    AccountingModule,
    DayClosingModule,
    InventoryModule,
    SalesModule,
    ServiceTransactionsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
