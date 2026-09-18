import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class StockAdjustmentDto {
  /**
   * Signed delta: positive to increase, negative to decrease. Fractional for
   * weight/volume units. May be 0 to correct a wrong cost/selling price with
   * no change in stock quantity — costPrice or sellingPrice must then be set.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity: number;

  @IsString()
  @MinLength(1)
  reason: string;

  /** When the newly-added batch expires — only meaningful when quantity is positive; ignored otherwise */
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  /** Cost/selling price for the newly-added batch, in cents — only meaningful when quantity is positive; omit to use the product's current price */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sellingPrice?: number;
}
