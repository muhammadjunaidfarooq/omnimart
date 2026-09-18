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

/**
 * Corrects a data-entry mistake on an already-existing batch — every field is
 * the batch's new absolute value, not a delta (unlike StockAdjustmentDto's
 * signed `quantity`). Use this when a batch was received with the wrong
 * quantity or price, not for recording an ordinary stock movement.
 */
export class UpdateStockBatchDto {
  /** Corrected total originally received. Fractional for weight/volume units. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantity?: number;

  /** Corrected quantity still in stock. Fractional for weight/volume units. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  remainingQuantity?: number;

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

  /** Corrected expiry date, or null to clear it. Omit to leave unchanged. */
  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;

  @IsString()
  @MinLength(1)
  reason: string;
}
