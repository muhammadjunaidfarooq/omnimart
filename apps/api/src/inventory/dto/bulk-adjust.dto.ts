import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class BulkAdjustDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];

  /**
   * Same signed delta applied to every selected product (positive to
   * increase, negative to decrease) — e.g. a stocktake correction affecting
   * many items alike. A product this delta can't apply to (insufficient
   * stock to remove, or a fractional delta on a whole-number-only unit) is
   * skipped rather than failing the whole batch.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  quantity: number;

  @IsString()
  @MinLength(1)
  reason: string;
}
