import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { BorrowerBillsQueryDto } from './dto/borrower-bills-query.dto';
import { BorrowerQueryDto } from './dto/borrower-query.dto';
import { PayAllDto } from './dto/pay-all.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { KhataService } from './khata.service';

// No @Roles restriction — any admin or cashier can view and settle khata
// bills, mirroring a shop's shared khata register.
@Controller('khata')
export class KhataController {
  constructor(private readonly khataService: KhataService) {}

  @Get('borrowers')
  findBorrowers(@Query() query: BorrowerQueryDto) {
    return this.khataService.findBorrowers(query);
  }

  @Get('borrowers/:id')
  findBorrowerBills(
    @Param('id') id: string,
    @Query() query: BorrowerBillsQueryDto,
  ) {
    return this.khataService.findBorrowerBills(id, query);
  }

  @Get('borrowers/:id/statement')
  getStatement(@Param('id') id: string, @Query() query: BorrowerBillsQueryDto) {
    return this.khataService.getStatement(id, query);
  }

  @Post('sales/:saleId/payments')
  recordPayment(
    @Param('saleId') saleId: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khataService.recordPayment(saleId, dto, user.sub);
  }

  @Post('borrowers/:id/pay-all')
  payAllOutstanding(
    @Param('id') id: string,
    @Body() dto: PayAllDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khataService.payAllOutstanding(
      id,
      user.sub,
      dto.paymentMethod,
      dto.amount,
      dto.transferReference,
    );
  }

  @Post('borrowers/:id/pay-from-credit')
  payFromCredit(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.khataService.payFromCredit(id, user.sub);
  }
}
