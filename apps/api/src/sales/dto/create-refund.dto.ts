import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class RefundItemDto {
  @IsUUID()
  saleItemId: string;

  /** Fractional for weight/volume units — must not exceed the original SaleItem's remaining refundable quantity */
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;
}

export class CreateRefundDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @ValidateNested({ each: true })
  @Type(() => RefundItemDto)
  @ArrayMinSize(1)
  items: RefundItemDto[];
}
