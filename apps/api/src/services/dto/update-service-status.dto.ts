import { IsBoolean } from 'class-validator';

export class UpdateServiceStatusDto {
  @IsBoolean()
  isActive: boolean;
}
