import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsUUID, Min } from 'class-validator';

export class BulkMinimumStockDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];

  /** Fractional for weight/volume units, same as the single-product edit form's field */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minimumStockLevel: number;
}
