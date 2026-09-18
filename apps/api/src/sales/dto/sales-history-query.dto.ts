import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { SaleFilterDto } from '../../common/dto/sale-filter.dto';

export type SalesHistorySortField =
  'invoiceNumber' | 'completedAt' | 'cashier' | 'paymentMethod' | 'totalAmount';

const SALES_HISTORY_SORT_FIELDS: SalesHistorySortField[] = [
  'invoiceNumber',
  'completedAt',
  'cashier',
  'paymentMethod',
  'totalAmount',
];

export class SalesHistoryQueryDto extends SaleFilterDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  /** Case-insensitive partial match against Sale.invoiceNumber, e.g. "42" or "INV-000042". */
  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsIn(SALES_HISTORY_SORT_FIELDS)
  sortBy?: SalesHistorySortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
