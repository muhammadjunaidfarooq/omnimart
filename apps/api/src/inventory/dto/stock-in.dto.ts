import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class StockInDto {
  /** Fractional for weight/volume units — whole-number enforcement happens server-side against the product's unit */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;

  /** When this batch expires — omit for products that don't expire */
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  /** Cost/selling price for this batch, in cents — omit to use the product's current price */
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
