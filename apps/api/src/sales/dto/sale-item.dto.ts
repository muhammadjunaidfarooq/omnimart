import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class SaleItemDto {
  @IsUUID()
  productId: string;

  /** Fractional for weight/volume units (e.g. Kg, Litre) — whole-number enforcement happens server-side against the product's unit */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  /** Cashier-applied override for this line — falls back to the product's own discount when omitted */
  @ValidateIf((dto: SaleItemDto) => dto.discountType != null)
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  /** Basis points if discountType is PERCENTAGE, cents if FIXED */
  @ValidateIf((dto: SaleItemDto) => dto.discountType != null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountValue?: number;

  /**
   * Cashier override for this line's unit selling price, in cents — applies
   * only to this sale, never persisted back to the product. Enforced
   * server-side to never go below the line's resolved cost price.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPriceOverride?: number;

  /**
   * Cashier override for this line's fixed total price, in cents — for a
   * quantity-based bundle price (e.g. "3 for 50") that can't be expressed
   * as a whole-cent unit price. Applies only to this sale, never persisted
   * back to the product. Mutually exclusive with unitPriceOverride and
   * enforced to never go below the line's resolved cost price for its
   * quantity — both checked in SalesService.computeLine, which has the
   * product name on hand for a helpful error message.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lineTotalOverride?: number;
}
