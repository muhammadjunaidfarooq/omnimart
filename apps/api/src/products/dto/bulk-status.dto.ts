import { ArrayMinSize, IsArray, IsBoolean, IsUUID } from 'class-validator';

export class BulkStatusDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids: string[];

  @IsBoolean()
  isActive: boolean;
}
