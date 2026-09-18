import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Roles(Role.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('kpis')
  getKpis(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getKpis(query);
  }

  @Get('recent-sales')
  getRecentSales(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getRecentSales(user, query);
  }

  @Get('recent-service-transactions')
  getRecentServiceTransactions(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getRecentServiceTransactions(user, query);
  }
}
