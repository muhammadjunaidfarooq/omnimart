import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export type ExpiryStatusFilter = 'all' | 'expired' | 'expiring_soon' | 'good';

export type ExpirySortField =
  'product' | 'sku' | 'remainingQuantity' | 'expiryDate';

const EXPIRY_SORT_FIELDS: ExpirySortField[] = [
  'product',
  'sku',
  'remainingQuantity',
  'expiryDate',
];

export class ExpiryQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['all', 'expired', 'expiring_soon', 'good'])
  status?: ExpiryStatusFilter;

  @IsOptional()
  @IsIn(EXPIRY_SORT_FIELDS)
  sortBy?: ExpirySortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;
}
