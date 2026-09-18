import { IsDateString, IsOptional } from 'class-validator';

export class DayClosingPreviewQueryDto {
  /** Defaults to today */
  @IsOptional()
  @IsDateString()
  date?: string;
}
