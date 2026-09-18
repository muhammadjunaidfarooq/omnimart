import { IsDateString, IsOptional } from 'class-validator';

export class BorrowerBillsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
