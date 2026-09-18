import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { AccountingService } from './accounting.service';
import { DateRangeQueryDto } from './dto/date-range-query.dto';
import { DailySummaryQueryDto } from './dto/daily-summary-query.dto';

@Roles(Role.ADMIN)
@Controller('accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('pnl')
  getPnl(@Query() query: DateRangeQueryDto) {
    return this.accountingService.getPnl(query);
  }

  @Get('daily-cash-summary')
  getDailyCashSummary(@Query() query: DailySummaryQueryDto) {
    return this.accountingService.getDailyCashSummary(query);
  }

  @Get('monthly-pnl')
  getMonthlyPnl(@Query() query: DateRangeQueryDto) {
    return this.accountingService.getMonthlyPnl(query);
  }

  @Get('cash-vs-transfer')
  getCashVsTransferDaily(@Query() query: DateRangeQueryDto) {
    return this.accountingService.getCashVsTransferDaily(query);
  }
}
