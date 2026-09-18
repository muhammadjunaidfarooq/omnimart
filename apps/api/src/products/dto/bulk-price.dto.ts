import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsNumber, IsUUID } from 'class-validator';

export type BulkPriceMode = 'SET' | 'PERCENT' | 'AMOUNT';

const BULK_PRICE_MODES: BulkPriceMode[] = ['SET', 'PERCENT', 'AMOUNT'];

export class BulkPriceDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];

  @IsIn(BULK_PRICE_MODES)
  mode: BulkPriceMode;

  /**
   * Meaning depends on mode: SET = new selling price in cents (>= 0);
   * PERCENT = signed percent change (e.g. 10 = +10%, -15 = -15%);
   * AMOUNT = signed cents delta. Every result is floored at 0.
   */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  value: number;
}
