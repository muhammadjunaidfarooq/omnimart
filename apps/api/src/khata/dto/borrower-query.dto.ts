import { IsOptional, IsString } from 'class-validator';

export class BorrowerQueryDto {
  @IsOptional()
  @IsString()
  search?: string;
}
