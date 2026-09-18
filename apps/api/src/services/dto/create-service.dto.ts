import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ServiceDirection } from '@prisma/client';

export class CreateServiceDto {
  @IsString()
  name: string;

  /** Determines which fields a transaction on this service expects — see ServiceDirection. Defaults to BILL_PAYMENT. */
  @IsOptional()
  @IsEnum(ServiceDirection)
  direction?: ServiceDirection;

  /** Cents — prefills the cashier's service fee field; omit for no default fee. Ignored when useTieredFee is true, or when direction isn't BILL_PAYMENT. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultFee?: number;

  /** When true, the fee is computed from the bill amount instead of defaultFee — see feePerThousand */
  @IsOptional()
  @IsBoolean()
  useTieredFee?: boolean;

  /** Cents charged per Rs 1,000 of the bill amount, rounded up — required when useTieredFee is true */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  feePerThousand?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
