import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { KhataService } from './khata.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrisma, MockPrisma } from '../test-utils/prisma-mock';

function creditSale(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sale-1',
    totalAmount: 500,
    amountPaid: 0,
    paymentMethod: PaymentMethod.CREDIT,
    paymentStatus: PaymentStatus.UNPAID,
    borrowerId: 'borrower-1',
    refunds: [],
    ...overrides,
  };
}

describe('KhataService.recordPayment', () => {
  let prisma: MockPrisma;
  let service: KhataService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new KhataService(prisma as unknown as PrismaService);
    prisma.sale.update.mockImplementation(({ data }: any) => ({
      id: 'sale-1',
      ...data,
    }));
  });

  it('rejects paying a non-khata (CASH/TRANSFER) sale', async () => {
    prisma.sale.findUnique.mockResolvedValue(
      creditSale({ paymentMethod: PaymentMethod.CASH }),
    );

    await expect(
      service.recordPayment('sale-1', { amount: 100 } as any, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects paying a bill that is already fully paid', async () => {
    prisma.sale.findUnique.mockResolvedValue(
      creditSale({ paymentStatus: PaymentStatus.PAID }),
    );

    await expect(
      service.recordPayment('sale-1', { amount: 100 } as any, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects paying a bill fully covered by refunds already', async () => {
    prisma.sale.findUnique.mockResolvedValue(
      creditSale({ refunds: [{ totalAmount: 500 }] }),
    );

    await expect(
      service.recordPayment('sale-1', { amount: 100 } as any, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('applies a partial payment and leaves the bill PARTIALLY_PAID', async () => {
    prisma.sale.findUnique.mockResolvedValue(creditSale());

    const result = await service.recordPayment(
      'sale-1',
      { amount: 200, paymentMethod: PaymentMethod.CASH } as any,
      'admin-1',
    );

    expect(prisma.sale.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { amountPaid: 200, paymentStatus: PaymentStatus.PARTIALLY_PAID },
    });
    expect(result.creditAdded).toBe(0);
  });

  it('marks the bill PAID once the payment meets the total', async () => {
    prisma.sale.findUnique.mockResolvedValue(creditSale());

    await service.recordPayment(
      'sale-1',
      { amount: 500, paymentMethod: PaymentMethod.CASH } as any,
      'admin-1',
    );

    expect(prisma.sale.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { amountPaid: 500, paymentStatus: PaymentStatus.PAID },
    });
  });

  it('banks an overpayment as store credit instead of over-crediting the bill', async () => {
    prisma.sale.findUnique.mockResolvedValue(creditSale());

    const result = await service.recordPayment(
      'sale-1',
      { amount: 700, paymentMethod: PaymentMethod.CASH } as any,
      'admin-1',
    );

    // Only the 500 actually due is applied to the bill...
    expect(prisma.sale.update).toHaveBeenCalledWith({
      where: { id: 'sale-1' },
      data: { amountPaid: 500, paymentStatus: PaymentStatus.PAID },
    });
    // ...the other 200 becomes store credit.
    expect(prisma.borrower.update).toHaveBeenCalledWith({
      where: { id: 'borrower-1' },
      data: { creditBalance: { increment: 200 } },
    });
    expect(result.creditAdded).toBe(200);
  });

  it('records the KhataPayment ledger entry with the amount actually applied to the bill', async () => {
    prisma.sale.findUnique.mockResolvedValue(creditSale());

    await service.recordPayment(
      'sale-1',
      { amount: 700, paymentMethod: PaymentMethod.CASH, note: 'partial cash' } as any,
      'admin-1',
    );

    expect(prisma.khataPayment.create).toHaveBeenCalledWith({
      data: {
        saleId: 'sale-1',
        amount: 500,
        method: PaymentMethod.CASH,
        transferReference: undefined,
        receivedById: 'admin-1',
        note: 'partial cash',
      },
    });
  });
});

describe('KhataService.payAllOutstanding', () => {
  let prisma: MockPrisma;
  let service: KhataService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new KhataService(prisma as unknown as PrismaService);
    prisma.borrower.findUnique.mockResolvedValue({ id: 'borrower-1' });
    prisma.sale.update.mockImplementation(({ data }: any) => ({ ...data }));
  });

  it('rejects when the borrower has no outstanding bills', async () => {
    prisma.sale.findMany.mockResolvedValue([]);

    await expect(
      service.payAllOutstanding('borrower-1', 'admin-1', PaymentMethod.CASH),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when the borrower does not exist', async () => {
    prisma.borrower.findUnique.mockResolvedValue(null);

    await expect(
      service.payAllOutstanding('borrower-1', 'admin-1', PaymentMethod.CASH),
    ).rejects.toThrow(NotFoundException);
  });

  it('settles bills oldest-first, fully paying earlier ones before touching a later one', async () => {
    prisma.sale.findMany.mockResolvedValue([
      creditSale({ id: 'sale-1', totalAmount: 100, amountPaid: 0 }),
      creditSale({ id: 'sale-2', totalAmount: 300, amountPaid: 0 }),
    ]);

    const result = await service.payAllOutstanding(
      'borrower-1',
      'admin-1',
      PaymentMethod.CASH,
      150,
    );

    // sale-1 (100 due) is fully settled, sale-2 gets only the 50 remaining.
    expect(prisma.sale.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'sale-1' },
      data: { amountPaid: 100, paymentStatus: PaymentStatus.PAID },
    });
    expect(prisma.sale.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'sale-2' },
      data: { amountPaid: 50, paymentStatus: PaymentStatus.PARTIALLY_PAID },
    });
    expect(result.settledBillCount).toBe(1);
    expect(result.totalSettled).toBe(150);
  });

  it('settling every bill in full with no amount specified leaves no store credit', async () => {
    prisma.sale.findMany.mockResolvedValue([
      creditSale({ id: 'sale-1', totalAmount: 100, amountPaid: 0 }),
    ]);

    const result = await service.payAllOutstanding(
      'borrower-1',
      'admin-1',
      PaymentMethod.CASH,
    );

    expect(result.settledBillCount).toBe(1);
    expect(result.creditAdded).toBe(0);
    expect(prisma.borrower.update).not.toHaveBeenCalled();
  });

  it('banks the leftover as store credit when paying more than the total due', async () => {
    prisma.sale.findMany.mockResolvedValue([
      creditSale({ id: 'sale-1', totalAmount: 100, amountPaid: 0 }),
    ]);

    const result = await service.payAllOutstanding(
      'borrower-1',
      'admin-1',
      PaymentMethod.CASH,
      150,
    );

    expect(result.creditAdded).toBe(50);
    expect(prisma.borrower.update).toHaveBeenCalledWith({
      where: { id: 'borrower-1' },
      data: { creditBalance: { increment: 50 } },
    });
  });
});

describe('KhataService.payFromCredit', () => {
  let prisma: MockPrisma;
  let service: KhataService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new KhataService(prisma as unknown as PrismaService);
    prisma.sale.update.mockImplementation(({ data }: any) => ({ ...data }));
  });

  it('rejects when the borrower has no credit balance', async () => {
    prisma.borrower.findUnique.mockResolvedValue({
      id: 'borrower-1',
      creditBalance: 0,
    });

    await expect(
      service.payFromCredit('borrower-1', 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('applies only as much credit as covers the total due, tagging the payment CREDIT', async () => {
    prisma.borrower.findUnique.mockResolvedValue({
      id: 'borrower-1',
      creditBalance: 1000,
    });
    prisma.sale.findMany.mockResolvedValue([
      creditSale({ id: 'sale-1', totalAmount: 300, amountPaid: 0 }),
    ]);

    const result = await service.payFromCredit('borrower-1', 'admin-1');

    expect(prisma.borrower.update).toHaveBeenCalledWith({
      where: { id: 'borrower-1' },
      data: { creditBalance: { decrement: 300 } },
    });
    expect(prisma.khataPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: 300, method: PaymentMethod.CREDIT }),
      }),
    );
    expect(result.remainingDue).toBe(0);
  });

  it('leaves a remaining balance when credit does not fully cover what is due', async () => {
    prisma.borrower.findUnique.mockResolvedValue({
      id: 'borrower-1',
      creditBalance: 100,
    });
    prisma.sale.findMany.mockResolvedValue([
      creditSale({ id: 'sale-1', totalAmount: 300, amountPaid: 0 }),
    ]);

    const result = await service.payFromCredit('borrower-1', 'admin-1');

    expect(result.remainingDue).toBe(200);
    expect(prisma.borrower.update).toHaveBeenCalledWith({
      where: { id: 'borrower-1' },
      data: { creditBalance: { decrement: 100 } },
    });
  });
});

describe('KhataService.settleOrCredit', () => {
  let prisma: MockPrisma;
  let service: KhataService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new KhataService(prisma as unknown as PrismaService);
    prisma.sale.update.mockImplementation(({ data }: any) => ({ ...data }));
  });

  it('is a no-op for a non-positive amount', async () => {
    const result = await service.settleOrCredit(
      prisma as any,
      'borrower-1',
      'admin-1',
      0,
      'note',
    );

    expect(result).toEqual({
      settledBillCount: 0,
      totalSettled: 0,
      creditAdded: 0,
    });
    expect(prisma.sale.findMany).not.toHaveBeenCalled();
  });

  it('pays down existing khata first, banking only the leftover as credit', async () => {
    prisma.sale.findMany.mockResolvedValue([
      creditSale({ id: 'sale-1', totalAmount: 100, amountPaid: 0 }),
    ]);

    const result = await service.settleOrCredit(
      prisma as any,
      'borrower-1',
      'admin-1',
      150,
      'Cash overpayment credited at checkout',
    );

    expect(result).toEqual({
      settledBillCount: 1,
      totalSettled: 100,
      creditAdded: 50,
    });
    expect(prisma.borrower.update).toHaveBeenCalledWith({
      where: { id: 'borrower-1' },
      data: { creditBalance: { increment: 50 } },
    });
  });

  it('banks the full amount as credit when the borrower has no outstanding khata', async () => {
    prisma.sale.findMany.mockResolvedValue([]);

    const result = await service.settleOrCredit(
      prisma as any,
      'borrower-1',
      'admin-1',
      75,
      'note',
    );

    expect(result).toEqual({
      settledBillCount: 0,
      totalSettled: 0,
      creditAdded: 75,
    });
  });
});
