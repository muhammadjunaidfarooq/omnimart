import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountingModule } from './accounting/accounting.module';
import { AuthModule } from './auth/auth.module';
import { JwtAccessGuard } from './auth/guards/jwt-access.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { BrandsModule } from './brands/brands.module';
import { CategoriesModule } from './categories/categories.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DayClosingModule } from './day-closing/day-closing.module';
import { ExpensesModule } from './expenses/expenses.module';
import { InventoryModule } from './inventory/inventory.module';
import { KhataModule } from './khata/khata.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { ServiceTransactionsModule } from './service-transactions/service-transactions.module';
import { ServicesModule } from './services/services.module';
import { SettingsModule } from './settings/settings.module';
import { UnitsModule } from './units/units.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Generous global default (per IP) so normal app traffic is never
    // affected — routes that need a stricter limit (e.g. login) override it
    // with @Throttle(...).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    BrandsModule,
    UnitsModule,
    ProductsModule,
    InventoryModule,
    SalesModule,
    KhataModule,
    ExpensesModule,
    ServicesModule,
    ServiceTransactionsModule,
    AccountingModule,
    DashboardModule,
    DayClosingModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Throttling runs first, so abusive traffic is rejected before any auth work.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAccessGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
