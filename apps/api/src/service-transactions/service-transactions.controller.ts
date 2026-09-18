import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateServiceTransactionDto } from './dto/create-service-transaction.dto';
import { ServiceTransactionQueryDto } from './dto/service-transaction-query.dto';
import { ServiceTransactionsService } from './service-transactions.service';

// No @Roles restriction — a CASHIER records transactions at the POS and an
// ADMIN reviews them, mirroring SalesController's checkout/history split.
@Controller('service-transactions')
export class ServiceTransactionsController {
  constructor(
    private readonly serviceTransactionsService: ServiceTransactionsService,
  ) {}

  @Get()
  findAll(
    @Query() query: ServiceTransactionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.serviceTransactionsService.findAll(query, user);
  }

  @Post()
  create(
    @Body() dto: CreateServiceTransactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.serviceTransactionsService.create(dto, user.sub);
  }
}
