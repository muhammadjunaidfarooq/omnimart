import { BadRequestException } from '@nestjs/common';
import { DiscountType, PaymentMethod } from '@prisma/client';
import { SalesService } from './sales.service';
import { InventoryService } from '../inventory/inventory.service';
import { KhataService } from '../khata/khata.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrisma, MockPrisma } from '../test-utils/prisma-mock';

/** A minimal product fixture matching what computeSale/computeLine read off it. */
function makeProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'prod-1',
    name: 'Widget',
    sku: 'PRD-000001',
    isActive: true,
    costPrice: 100,
    sellingPrice: 200,
    taxRateBps: 0,
    discountType: null,
    discountValue: null,
    unit: { allowsFractionalQuantity: false },
    ...overrides,
  };
}

const SETTINGS = {
  id: 1,
  globalDiscountEnabled: false,
  globalDiscountType: null,
  globalDiscountValue: null,
};

describe('SalesService.checkout', () => {
  let prisma: MockPrisma;
  let inventoryService: jest.Mocked<
    Pick<InventoryService, 'resolveLinePrice' | 'consumeFefo' | 'restockToBatches'>
  >;
  let khataService: jest.Mocked<Pick<KhataService, 'settleOrCredit'>>;
  let service: SalesService;

  beforeEach(() => {
    prisma = createMockPrisma();
    inventoryService = {
      resolveLinePrice: jest.fn(),
      consumeFefo: jest.fn(),
      restockToBatches: jest.fn(),
    } as never;
    khataService = {
      settleOrCredit: jest.fn(),
    } as never;

    service = new SalesService(
      prisma as unknown as PrismaService,
      inventoryService as unknown as InventoryService,
      khataService as unknown as KhataService,
    );

    prisma.businessSettings.findUniqueOrThrow.mockResolvedValue(SETTINGS);
    prisma.$queryRaw.mockResolvedValue([{ lastValue: 1 }]);
    prisma.sale.create.mockImplementation(({ data }: any) => ({
      id: 'sale-1',
      invoiceNumber: 'INV-000001',
      ...data,
    }));
    prisma.sale.findUniqueOrThrow.mockImplementation(() => ({ id: 'sale-1' }));
    prisma.saleItem.create.mockImplementation(({ data }: any) => ({
      id: `item-${data.productId}`,
      ...data,
    }));
    inventoryService.resolveLinePrice.mockImplementation(async () => ({
      costPrice: 100,
      sellingPrice: 200,
    }));
  });

  function oneItem(overrides: Partial<Record<string, unknown>> = {}) {
    return [{ productId: 'prod-1', quantity: 1, ...overrides }];
  }

  it('settles a CASH sale paid exactly, with zero change', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);

    const result = await service.checkout(
      {
        items: oneItem(),
        paymentMethod: PaymentMethod.CASH,
        cashTendered: 200,
      } as any,
      'cashier-1',
    );

    expect(result.id).toBe('sale-1');
    const saleData = prisma.sale.create.mock.calls[0][0].data;
    expect(saleData.totalAmount).toBe(200);
    expect(saleData.changeDue).toBe(0);
    expect(saleData.paymentStatus).toBe('PAID');
    expect(saleData.amountPaid).toBe(200);
  });

  it('computes change due for a CASH overpayment', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);

    await service.checkout(
      {
        items: oneItem(),
        paymentMethod: PaymentMethod.CASH,
        cashTendered: 250,
      } as any,
      'cashier-1',
    );

    const saleData = prisma.sale.create.mock.calls[0][0].data;
    expect(saleData.changeDue).toBe(50);
  });

  it('rejects a CASH sale tendered less than the total, before touching inventory', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);

    await expect(
      service.checkout(
        {
          items: oneItem(),
          paymentMethod: PaymentMethod.CASH,
          cashTendered: 100,
        } as any,
        'cashier-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(inventoryService.consumeFefo).not.toHaveBeenCalled();
    expect(prisma.sale.create).not.toHaveBeenCalled();
  });

  it('rejects a SPLIT sale whose cash portion is not less than the total', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);

    await expect(
      service.checkout(
        {
          items: oneItem(),
          paymentMethod: PaymentMethod.SPLIT,
          cashAmount: 200,
          borrowerId: 'borrower-1',
        } as any,
        'cashier-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects CREDIT/SPLIT without a borrower', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);

    await expect(
      service.checkout(
        { items: oneItem(), paymentMethod: PaymentMethod.CREDIT } as any,
        'cashier-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('applies a borrower store credit smaller than the total, leaving the sale partially paid', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);
    prisma.borrower.findUnique.mockResolvedValue({
      id: 'borrower-1',
      creditBalance: 50,
    });

    await service.checkout(
      {
        items: oneItem(),
        paymentMethod: PaymentMethod.CREDIT,
        borrowerId: 'borrower-1',
      } as any,
      'cashier-1',
    );

    expect(prisma.borrower.update).toHaveBeenCalledWith({
      where: { id: 'borrower-1' },
      data: { creditBalance: { decrement: 50 } },
    });
    const saleData = prisma.sale.create.mock.calls[0][0].data;
    expect(saleData.amountPaid).toBe(50);
    expect(saleData.paymentStatus).toBe('PARTIALLY_PAID');
  });

  it('caps the applied store credit at the amount actually due, banking none of the excess again', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);
    prisma.borrower.findUnique.mockResolvedValue({
      id: 'borrower-1',
      creditBalance: 300,
    });

    await service.checkout(
      {
        items: oneItem(),
        paymentMethod: PaymentMethod.CREDIT,
        borrowerId: 'borrower-1',
      } as any,
      'cashier-1',
    );

    // Total is 200 — only 200 of the 300 credit should be drawn down.
    expect(prisma.borrower.update).toHaveBeenCalledWith({
      where: { id: 'borrower-1' },
      data: { creditBalance: { decrement: 200 } },
    });
    const saleData = prisma.sale.create.mock.calls[0][0].data;
    expect(saleData.amountPaid).toBe(200);
    expect(saleData.paymentStatus).toBe('PAID');
  });

  it('diverts CASH change into borrower credit via KhataService instead of returning it', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);
    prisma.borrower.findUnique.mockResolvedValue({
      id: 'borrower-1',
      creditBalance: 0,
    });
    khataService.settleOrCredit.mockResolvedValue({
      settledBillCount: 0,
      totalSettled: 0,
      creditAdded: 50,
    });

    await service.checkout(
      {
        items: oneItem(),
        paymentMethod: PaymentMethod.CASH,
        cashTendered: 250,
        borrowerId: 'borrower-1',
        creditChangeToBorrower: true,
      } as any,
      'cashier-1',
    );

    expect(khataService.settleOrCredit).toHaveBeenCalledWith(
      prisma,
      'borrower-1',
      'cashier-1',
      50,
      'Cash overpayment credited at checkout',
    );
    const saleData = prisma.sale.create.mock.calls[0][0].data;
    // The change was credited away, not handed back — the sale record shows none due.
    expect(saleData.changeDue).toBe(0);
  });

  it('clamps a fixed discount larger than the line so the line total never goes negative', async () => {
    prisma.product.findMany.mockResolvedValue([
      makeProduct({ discountType: DiscountType.FIXED, discountValue: 500 }),
    ]);

    await service.checkout(
      {
        items: oneItem(),
        paymentMethod: PaymentMethod.CASH,
        cashTendered: 0,
      } as any,
      'cashier-1',
    );

    const saleData = prisma.sale.create.mock.calls[0][0].data;
    expect(saleData.discountTotal).toBe(200); // clamped to the line's own subtotal
    expect(saleData.totalAmount).toBe(0);
  });

  it('rejects a per-line price override below the active batch cost price', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);

    await expect(
      service.checkout(
        {
          items: oneItem({ unitPriceOverride: 50 }),
          paymentMethod: PaymentMethod.CASH,
          cashTendered: 50,
        } as any,
        'cashier-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('draws down inventory (consumeFefo) for each sale line after the sale row is created', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct()]);

    await service.checkout(
      {
        items: oneItem({ quantity: 3 }),
        paymentMethod: PaymentMethod.CASH,
        cashTendered: 600,
      } as any,
      'cashier-1',
    );

    expect(inventoryService.consumeFefo).toHaveBeenCalledTimes(1);
    const [, params] = inventoryService.consumeFefo.mock.calls[0];
    expect(params).toMatchObject({
      productId: 'prod-1',
      type: 'OUT',
      quantity: 3,
      saleItemId: 'item-prod-1',
    });
  });

  it('rejects an unknown product id', async () => {
    prisma.product.findMany.mockResolvedValue([]);

    await expect(
      service.checkout(
        {
          items: oneItem(),
          paymentMethod: PaymentMethod.CASH,
          cashTendered: 200,
        } as any,
        'cashier-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a sale line for an inactive product', async () => {
    prisma.product.findMany.mockResolvedValue([makeProduct({ isActive: false })]);

    await expect(
      service.checkout(
        {
          items: oneItem(),
          paymentMethod: PaymentMethod.CASH,
          cashTendered: 200,
        } as any,
        'cashier-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('SalesService.refund', () => {
  let prisma: MockPrisma;
  let inventoryService: jest.Mocked<Pick<InventoryService, 'restockToBatches'>>;
  let service: SalesService;

  beforeEach(() => {
    prisma = createMockPrisma();
    inventoryService = { restockToBatches: jest.fn() } as never;
    service = new SalesService(
      prisma as unknown as PrismaService,
      inventoryService as unknown as InventoryService,
      {} as unknown as KhataService,
    );
    prisma.refund.create.mockImplementation(({ data }: any) => ({
      id: 'refund-1',
      ...data,
    }));
  });

  function completedSale(items: any[]) {
    return {
      id: 'sale-1',
      invoiceNumber: 'INV-000001',
      status: 'COMPLETED',
      items,
    };
  }

  it('rejects a refund quantity exceeding what remains unrefunded on the line', async () => {
    prisma.sale.findUnique.mockResolvedValue(
      completedSale([
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: 'Widget',
          quantity: 2,
          unitPrice: 200,
          lineDiscount: 0,
          lineTax: 0,
          refundItems: [{ quantity: 1 }],
        },
      ]),
    );

    await expect(
      service.refund(
        'sale-1',
        { items: [{ saleItemId: 'item-1', quantity: 2 }] } as any,
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects refunding a sale that is not COMPLETED', async () => {
    prisma.sale.findUnique.mockResolvedValue({
      id: 'sale-1',
      status: 'DRAFT',
      items: [],
    });

    await expect(
      service.refund('sale-1', { items: [] } as any, 'admin-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('prorates discount/tax/total for a partial refund and restocks the drawn batches', async () => {
    prisma.sale.findUnique.mockResolvedValue(
      completedSale([
        {
          id: 'item-1',
          productId: 'prod-1',
          productName: 'Widget',
          quantity: 4,
          unitPrice: 100,
          lineDiscount: 40,
          lineTax: 20,
          refundItems: [],
        },
      ]),
    );

    const refund = await service.refund(
      'sale-1',
      { items: [{ saleItemId: 'item-1', quantity: 2 }], reason: 'damaged' } as any,
      'admin-1',
    );

    // Half the line's quantity refunded => half its discount/tax.
    expect(refund.discountTotal).toBe(20);
    expect(refund.taxTotal).toBe(10);
    expect(refund.subtotal).toBe(200);
    expect(refund.totalAmount).toBe(190);

    expect(inventoryService.restockToBatches).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        saleItemId: 'item-1',
        quantity: 2,
        alreadyRefunded: 0,
      }),
    );
  });
});
