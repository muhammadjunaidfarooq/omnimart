import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsUUID()
  unitId: string;

  /** Cost price in cents */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPrice: number;

  /** Selling price in cents */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sellingPrice: number;

  /** Tax rate in basis points (1000 = 10.00%) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  taxRateBps?: number;

  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  /** Basis points if discountType is PERCENTAGE, cents if FIXED */
  @ValidateIf((dto: CreateProductDto) => dto.discountType != null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountValue?: number;

  /** Fractional for weight/volume units (e.g. Kg, Litre) — whole-number enforcement happens server-side against the product's unit */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minimumStockLevel?: number;

  /** Opening stock quantity — recorded as an initial batch + IN ledger movement, not written directly. Fractional for weight/volume units. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  initialStock?: number;

  /** When the initial stock batch expires — omit for products that don't expire */
  @IsOptional()
  @IsDateString()
  initialStockExpiryDate?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
