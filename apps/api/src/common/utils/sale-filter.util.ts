import { PaymentMethod, Prisma } from '@prisma/client';

/** Builds the `paymentMethod`/`cashierId` slice of a Sale `where` clause — shared by AccountingService and SalesService's report methods, all of which mix in SaleFilterDto. */
export function saleFilterFields(query: {
  paymentMethod?: PaymentMethod;
  cashierId?: string;
}): Prisma.SaleWhereInput {
  return {
    ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
    ...(query.cashierId ? { cashierId: query.cashierId } : {}),
  };
}
