import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export type InventorySortField =
  'name' | 'sku' | 'currentStock' | 'minimumStockLevel';

const INVENTORY_SORT_FIELDS: InventorySortField[] = [
  'name',
  'sku',
  'currentStock',
  'minimumStockLevel',
];

export class InventoryQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['all', 'low', 'out'])
  stockStatus?: 'all' | 'low' | 'out';

  /** Drops products whose category is hiddenFromPos — an independent filter, combinable with search/stockStatus. */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  excludeHiddenCategories?: boolean;

  @IsOptional()
  @IsIn(INVENTORY_SORT_FIELDS)
  sortBy?: InventorySortField;

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
