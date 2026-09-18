import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

/** Shared by report/dashboard query DTOs — both are plain columns on Sale, so filtering by them is a simple `where` extension wherever this is mixed in. */
export class SaleFilterDto {
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID()
  cashierId?: string;
}
