import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';

const SERVICE_PAYMENT_METHODS = [PaymentMethod.CASH, PaymentMethod.TRANSFER];

export class CreateServiceTransactionDto {
  @IsUUID()
  serviceId: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;

  /**
   * For a BILL_PAYMENT service: the underlying bill being paid, in cents (0
   * for a fee-only service). For CASH_WITHDRAWAL/CASH_DEPOSIT: the cash
   * amount handed to/received from the customer — must be greater than
   * zero, enforced in ServiceTransactionsService rather than here since 0
   * stays valid for a fee-only BILL_PAYMENT service.
   */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  billAmount: number;

  /** Cents — defaults from the service's defaultFee on the client, but always re-validated here. Ignored outside BILL_PAYMENT. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  serviceFee?: number;

  /** BILL_PAYMENT only — CASH or TRANSFER, defaults to CASH. Ignored for CASH_WITHDRAWAL/CASH_DEPOSIT, which fix their own payment method. */
  @IsOptional()
  @IsIn(SERVICE_PAYMENT_METHODS)
  paymentMethod?: PaymentMethod;

  /** BILL_PAYMENT/CASH only — required (and must cover the total) for CASH; ignored for TRANSFER, which is always paid in full */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountReceived?: number;

  /** Required for a BILL_PAYMENT/TRANSFER transaction, and always for CASH_WITHDRAWAL/CASH_DEPOSIT */
  @IsOptional()
  @IsString()
  transferReference?: string;

  /**
   * CASH_WITHDRAWAL/CASH_DEPOSIT only — confirms whether the fee comes out
   * of billAmount (true, e.g. 980 for a 1,000 request with a 20 fee) or is
   * added on top (false, e.g. 1,020). Ignored for BILL_PAYMENT, which is
   * always additive. Defaults to false.
   */
  @IsOptional()
  @IsBoolean()
  feeInclusive?: boolean;

  /** Free-text note — e.g. a withdrawal/deposit customer's name or phone number */
  @IsOptional()
  @IsString()
  note?: string;
}
