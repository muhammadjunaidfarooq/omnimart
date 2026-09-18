import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class BulkStockInDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];

  /**
   * Same quantity received for every selected product, each into its own
   * new batch. Fractional for weight/volume units — a product whose unit
   * doesn't allow that is skipped rather than failing the whole batch (see
   * InventoryService.bulkStockIn).
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @IsOptional()
  @IsString()
  reason?: string;

  /** When these new batches expire — omit for products that don't expire */
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  /** Cost/selling price for every new batch, in cents — omit to use each product's own current price */
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
