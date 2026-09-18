import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DiscountType } from '@prisma/client';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  storeName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  currencySymbol?: string;

  /** Basis points (1000 = 10.00%) */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  defaultTaxRateBps?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  taxLabel?: string;

  /** A batch expiring within this many days of today shows as "Expiring Soon" rather than "Good" */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expiryWarningDays?: number;

  @IsOptional()
  @IsString()
  invoiceFooterNote?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  showLogoOnInvoice?: boolean;

  /** When true, globalDiscountType/globalDiscountValue apply to every product at checkout */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  globalDiscountEnabled?: boolean;

  @IsOptional()
  @IsEnum(DiscountType)
  globalDiscountType?: DiscountType;

  /** Basis points if globalDiscountType is PERCENTAGE, cents if FIXED */
  @ValidateIf((dto: UpdateSettingsDto) => dto.globalDiscountType != null)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  globalDiscountValue?: number;
}
