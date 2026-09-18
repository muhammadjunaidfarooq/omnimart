import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { KHATA_PAYMENT_METHODS } from './record-payment.dto';

export class PayAllDto {
  /** Cents to apply toward the borrower's outstanding bills, oldest first. Omit to settle everything. Any excess over the total due is banked as store credit on the borrower. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount?: number;

  /** How this payment was actually received — counts toward Cash in Hand or Online Transfer for the day it's recorded, not the day the original sale(s) happened. */
  @IsIn(KHATA_PAYMENT_METHODS)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  transferReference?: string;
}
