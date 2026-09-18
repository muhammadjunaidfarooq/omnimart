import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CheckoutDto } from './dto/checkout.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { SalesHistoryQueryDto } from './dto/sales-history-query.dto';
import { SalesReportQueryDto } from './dto/sales-report-query.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get()
  findHistory(
    @Query() query: SalesHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.findHistory(query, user);
  }

  @Get('drafts')
  listDrafts(@CurrentUser() user: AuthenticatedUser) {
    return this.salesService.listDrafts(user.sub);
  }

  @Roles(Role.ADMIN)
  @Get('reports/top-products')
  getTopProducts(@Query() query: SalesReportQueryDto) {
    return this.salesService.getTopProducts(query);
  }

  // Wider than the other reports (top-products/monthly stay admin-only,
  // more detailed business intelligence) — a cashier can see the store's
  // day-level sales total to answer "how are we doing today", but nothing
  // broken down by product or month.
  @Roles(Role.ADMIN, Role.CASHIER)
  @Get('reports/daily')
  getDailySales(@Query() query: SalesReportQueryDto) {
    return this.salesService.getDailySales(query);
  }

  @Roles(Role.ADMIN)
  @Get('reports/monthly')
  getMonthlySales(@Query() query: SalesReportQueryDto) {
    return this.salesService.getMonthlySales(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.findOne(id, user);
  }

  @Post('draft')
  saveDraft(@Body() dto: SaveDraftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.saveDraft(dto, user.sub);
  }

  @Patch('draft/:id')
  updateDraft(
    @Param('id') id: string,
    @Body() dto: SaveDraftDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.saveDraft(dto, user.sub, id);
  }

  @Delete('draft/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDraft(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.deleteDraft(id, user.sub);
  }

  @Post('checkout')
  checkout(@Body() dto: CheckoutDto, @CurrentUser() user: AuthenticatedUser) {
    return this.salesService.checkout(dto, user.sub);
  }

  @Post(':id/checkout')
  checkoutDraft(
    @Param('id') id: string,
    @Body() dto: CheckoutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.checkout(dto, user.sub, id);
  }

  @Roles(Role.ADMIN)
  @Post(':id/refund')
  refund(
    @Param('id') id: string,
    @Body() dto: CreateRefundDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.salesService.refund(id, dto, user.sub);
  }
}
