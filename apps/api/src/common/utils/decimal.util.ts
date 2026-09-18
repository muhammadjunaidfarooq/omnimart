import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Converts a Prisma Decimal field to a plain JS number for arithmetic/comparisons. Passing through a plain number is a no-op, so call sites don't need to know which type they received. */
export function toNumber(value: Prisma.Decimal | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

/**
 * Enforces that a quantity is a whole number unless its unit explicitly
 * allows fractional quantities (see Unit.allowsFractionalQuantity) — e.g. a
 * Kilogram product can be sold as 0.25, but a Piece product cannot.
 */
export function assertValidQuantity(
  quantity: number,
  allowsFractionalQuantity: boolean,
  context = 'Quantity',
) {
  if (!allowsFractionalQuantity && !Number.isInteger(quantity)) {
    throw new BadRequestException(
      `${context} must be a whole number for this product's unit`,
    );
  }
}
