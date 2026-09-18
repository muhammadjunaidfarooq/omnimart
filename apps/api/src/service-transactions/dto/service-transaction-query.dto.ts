import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export type ServiceTransactionSortField =
  'transactionNumber' | 'createdAt' | 'service' | 'cashier' | 'totalAmount';

const SERVICE_TRANSACTION_SORT_FIELDS: ServiceTransactionSortField[] = [
  'transactionNumber',
  'createdAt',
  'service',
  'cashier',
  'totalAmount',
];

export class ServiceTransactionQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  /** Only honored for an ADMIN caller — a CASHIER is always scoped to their own transactions */
  @IsOptional()
  @IsUUID()
  cashierId?: string;

  @IsOptional()
  @IsIn(SERVICE_TRANSACTION_SORT_FIELDS)
  sortBy?: ServiceTransactionSortField;

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
