import { IsDateString, IsOptional } from 'class-validator';
import { SaleFilterDto } from '../../common/dto/sale-filter.dto';

export class DateRangeQueryDto extends SaleFilterDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
