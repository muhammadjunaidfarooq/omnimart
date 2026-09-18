import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CloseDayDto {
  /** Defaults to today */
  @IsOptional()
  @IsDateString()
  date?: string;

  /** Cents of today's cash drawer spent buying inventory during the day */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cashUsedForInventory: number;

  @IsOptional()
  @IsString()
  note?: string;
}
