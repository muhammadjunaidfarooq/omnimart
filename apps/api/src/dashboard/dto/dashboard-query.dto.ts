import { IsDateString, IsOptional } from 'class-validator';
import { SaleFilterDto } from '../../common/dto/sale-filter.dto';

/** Both from/to are optional — omit both to keep each widget's own default window (today / last 30 days / last 12 months); set either to override it. */
export class DashboardQueryDto extends SaleFilterDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
