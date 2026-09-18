import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

/** A khata settlement is always a new incoming payment — CREDIT (store credit) and SPLIT don't apply here. */
export const KHATA_PAYMENT_METHODS = [
  PaymentMethod.CASH,
  PaymentMethod.TRANSFER,
] as const;

export class RecordPaymentDto {
  /** Cents received in this settlement — any amount over the sale's remaining amount due is banked as store credit on the borrower */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;

  /** How this payment was actually received — counts toward Cash in Hand or Online Transfer for the day it's recorded, not the day the original sale happened. */
  @IsIn(KHATA_PAYMENT_METHODS)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  transferReference?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
