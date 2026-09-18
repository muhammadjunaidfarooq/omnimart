import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ExpenseCategory } from '@prisma/client';

export type ExpenseSortField = 'date' | 'category' | 'amount' | 'createdBy';

const EXPENSE_SORT_FIELDS: ExpenseSortField[] = [
  'date',
  'category',
  'amount',
  'createdBy',
];

export class ExpenseQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsIn(EXPENSE_SORT_FIELDS)
  sortBy?: ExpenseSortField;

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
