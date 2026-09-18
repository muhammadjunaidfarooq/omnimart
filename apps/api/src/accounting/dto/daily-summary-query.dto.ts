import { IsDateString, IsOptional } from 'class-validator';
import { SaleFilterDto } from '../../common/dto/sale-filter.dto';

export class DailySummaryQueryDto extends SaleFilterDto {
  /** A single day — mutually exclusive with from/to, kept for the existing single-day Daily Cash Summary use */
  @IsOptional()
  @IsDateString()
  date?: string;

  /** A range instead of a single day — lets the same summary power the dashboard's Cash in Hand/Online Transfer tiles over an arbitrary window */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
