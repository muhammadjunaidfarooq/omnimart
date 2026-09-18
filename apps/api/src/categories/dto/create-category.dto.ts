import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** When true, cashiers never see this category or its products in the POS. */
  @IsOptional()
  @IsBoolean()
  hiddenFromPos?: boolean;
}
