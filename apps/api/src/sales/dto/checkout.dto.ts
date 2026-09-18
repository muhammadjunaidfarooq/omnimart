import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { SaleItemDto } from './sale-item.dto';

export class CheckoutDto {
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  @ArrayMinSize(1)
  items: SaleItemDto[];

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ValidateIf((dto: CheckoutDto) => dto.paymentMethod === PaymentMethod.CASH)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cashTendered?: number;

  @ValidateIf(
    (dto: CheckoutDto) => dto.paymentMethod === PaymentMethod.TRANSFER,
  )
  @IsString()
  @MinLength(1)
  transferReference?: string;

  /** Cents paid in cash up front for a SPLIT sale — the remainder is billed to the borrower as khata */
  @ValidateIf((dto: CheckoutDto) => dto.paymentMethod === PaymentMethod.SPLIT)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cashAmount?: number;

  /**
   * An existing borrower — mutually exclusive with newBorrowerName. Required
   * whenever the sale bills a khata debt (CREDIT/SPLIT) or diverts CASH
   * change into a borrower's credit balance; otherwise attaching a customer
   * to the sale is entirely optional (e.g. a fully-paid CASH/TRANSFER sale
   * the cashier still wants linked to a customer's history).
   */
  @IsOptional()
  @IsUUID()
  borrowerId?: string;

  /** Creates a new borrower inline — required when a borrower is needed without an existing borrowerId, otherwise optional. */
  @ValidateIf(
    (dto: CheckoutDto) =>
      (needsBorrower(dto) && !dto.borrowerId) ||
      dto.newBorrowerName !== undefined,
  )
  @IsString()
  @MinLength(1)
  newBorrowerName?: string;

  @IsOptional()
  @IsString()
  newBorrowerPhone?: string;

  /** Whether to auto-apply the borrower's existing store credit toward this sale — the cashier confirms this with the customer at checkout. Defaults to true. */
  @ValidateIf((dto: CheckoutDto) => isCreditLike(dto.paymentMethod))
  @IsOptional()
  @IsBoolean()
  useCredit?: boolean;

  /** For a CASH sale with change due: credit the change to the borrower instead of handing it back. */
  @ValidateIf((dto: CheckoutDto) => dto.paymentMethod === PaymentMethod.CASH)
  @IsOptional()
  @IsBoolean()
  creditChangeToBorrower?: boolean;
}

/** CREDIT bills the whole sale to khata; SPLIT bills only the remainder after cashAmount. */
function isCreditLike(method: PaymentMethod): boolean {
  return method === PaymentMethod.CREDIT || method === PaymentMethod.SPLIT;
}

/** Whether this checkout needs a borrower — either it bills a khata debt, or it diverts CASH change into a borrower's credit balance. */
function needsBorrower(dto: CheckoutDto): boolean {
  return (
    isCreditLike(dto.paymentMethod) ||
    (dto.paymentMethod === PaymentMethod.CASH &&
      dto.creditChangeToBorrower === true)
  );
}
