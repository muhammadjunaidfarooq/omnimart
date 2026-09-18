import { ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class BulkCategoryDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;
}
