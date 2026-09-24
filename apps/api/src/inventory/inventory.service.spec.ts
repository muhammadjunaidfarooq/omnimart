import { BadRequestException } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { createMockPrisma, MockPrisma } from '../test-utils/prisma-mock';

function tx(prisma: MockPrisma): Prisma.TransactionClient {
  return prisma as unknown as Prisma.TransactionClient;
}

describe('InventoryService.recordMovement', () => {
  let prisma: MockPrisma;
  let service: InventoryService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new InventoryService(prisma as unknown as PrismaService);
  });

  it('rejects a zero-quantity movement without writing a ledger entry', async () => {
    await expect(
      service.recordMovement(tx(prisma), {
        productId: 'prod-1',
        type: StockMovementType.ADJUSTMENT,
        quantity: 0,
        userId: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.product.update).not.toHaveBeenCalled();
    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects a movement that would drive stock negative, without writing a ledger entry', async () => {
    prisma.product.update.mockResolvedValue({ id: 'prod-1', currentStock: -1 });

    await expect(
      service.recordMovement(tx(prisma), {
        productId: 'prod-1',
        type: StockMovementType.OUT,
        quantity: -5,
        userId: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.stockMovement.create).not.toHaveBeenCalled();
  });

  it('applies the delta and writes a matching ledger entry', async () => {
    prisma.product.update.mockResolvedValue({
      id: 'prod-1',
      currentStock: 10,
    });

    await service.recordMovement(tx(prisma), {
      productId: 'prod-1',
      type: StockMovementType.IN,
      quantity: 5,
      userId: 'user-1',
      reason: 'Stock-in',
      batchId: 'batch-1',
    });

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 'prod-1' },
      data: { currentStock: { increment: 5 } },
    });
    expect(prisma.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: 'prod-1',
        type: StockMovementType.IN,
        quantity: 5,
        reason: 'Stock-in',
        userId: 'user-1',
        batchId: 'batch-1',
      },
    });
  });
});

describe('InventoryService.consumeFefo', () => {
  let prisma: MockPrisma;
  let service: InventoryService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new InventoryService(prisma as unknown as PrismaService);
    prisma.product.update.mockResolvedValue({
      id: 'prod-1',
      currentStock: 100,
    });
  });

  it('rejects consuming more than is available across all batches, without mutating any batch', async () => {
    prisma.stockBatch.findMany.mockResolvedValue([
      { id: 'batch-1', remainingQuantity: 2 },
    ]);

    await expect(
      service.consumeFefo(tx(prisma), {
        productId: 'prod-1',
        type: StockMovementType.OUT,
        quantity: 5,
        userId: 'user-1',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(prisma.stockBatch.update).not.toHaveBeenCalled();
  });

  it('draws entirely from a single sufficient batch', async () => {
    prisma.stockBatch.findMany.mockResolvedValue([
      { id: 'batch-1', remainingQuantity: 10 },
    ]);

    await service.consumeFefo(tx(prisma), {
      productId: 'prod-1',
      type: StockMovementType.OUT,
      quantity: 4,
      userId: 'user-1',
    });

    expect(prisma.stockBatch.update).toHaveBeenCalledTimes(1);
    expect(prisma.stockBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: { remainingQuantity: { decrement: 4 } },
    });
    expect(prisma.stockMovement.create).toHaveBeenCalledWith({
      data: {
        productId: 'prod-1',
        type: StockMovementType.OUT,
        quantity: -4,
        reason: undefined,
        userId: 'user-1',
        batchId: 'batch-1',
      },
    });
  });

  it('spills into the next FEFO-ordered batch once the first is exhausted', async () => {
    // Caller (Prisma's orderBy) is responsible for FEFO order; consumeFefo
    // just walks the array it's given earliest-first.
    prisma.stockBatch.findMany.mockResolvedValue([
      { id: 'batch-early', remainingQuantity: 3 },
      { id: 'batch-later', remainingQuantity: 10 },
    ]);

    await service.consumeFefo(tx(prisma), {
      productId: 'prod-1',
      type: StockMovementType.OUT,
      quantity: 5,
      userId: 'user-1',
    });

    expect(prisma.stockBatch.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'batch-early' },
      data: { remainingQuantity: { decrement: 3 } },
    });
    expect(prisma.stockBatch.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'batch-later' },
      data: { remainingQuantity: { decrement: 2 } },
    });
  });

  it('records which batch(es) a sale line drew from when saleItemId is given', async () => {
    prisma.stockBatch.findMany.mockResolvedValue([
      { id: 'batch-early', remainingQuantity: 3 },
      { id: 'batch-later', remainingQuantity: 10 },
    ]);

    await service.consumeFefo(tx(prisma), {
      productId: 'prod-1',
      type: StockMovementType.OUT,
      quantity: 5,
      userId: 'user-1',
      saleItemId: 'item-1',
    });

    expect(prisma.saleItemBatch.create).toHaveBeenNthCalledWith(1, {
      data: { saleItemId: 'item-1', batchId: 'batch-early', quantity: 3 },
    });
    expect(prisma.saleItemBatch.create).toHaveBeenNthCalledWith(2, {
      data: { saleItemId: 'item-1', batchId: 'batch-later', quantity: 2 },
    });
  });
});

describe('InventoryService.resolveLinePrice', () => {
  let prisma: MockPrisma;
  let service: InventoryService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new InventoryService(prisma as unknown as PrismaService);
  });

  it('prices from the first batch when it alone covers the quantity', async () => {
    prisma.stockBatch.findMany.mockResolvedValue([
      { remainingQuantity: 10, costPrice: 100, sellingPrice: 200 },
      { remainingQuantity: 10, costPrice: 150, sellingPrice: 250 },
    ]);

    const price = await service.resolveLinePrice(tx(prisma), 'prod-1', 4);

    expect(price).toEqual({ costPrice: 100, sellingPrice: 200 });
  });

  it('prices the whole line from the batch it spills into, not a blend', async () => {
    prisma.stockBatch.findMany.mockResolvedValue([
      { remainingQuantity: 3, costPrice: 100, sellingPrice: 200 },
      { remainingQuantity: 10, costPrice: 150, sellingPrice: 250 },
    ]);

    const price = await service.resolveLinePrice(tx(prisma), 'prod-1', 5);

    expect(price).toEqual({ costPrice: 150, sellingPrice: 250 });
  });

  it('falls back to the product price when no batch covers the full quantity', async () => {
    prisma.stockBatch.findMany.mockResolvedValue([
      { remainingQuantity: 2, costPrice: 100, sellingPrice: 200 },
    ]);
    prisma.product.findUniqueOrThrow.mockResolvedValue({
      costPrice: 90,
      sellingPrice: 180,
    });

    const price = await service.resolveLinePrice(tx(prisma), 'prod-1', 5);

    expect(price).toEqual({ costPrice: 90, sellingPrice: 180 });
  });

  it('falls back to the product price when there are no batches at all', async () => {
    prisma.stockBatch.findMany.mockResolvedValue([]);
    prisma.product.findUniqueOrThrow.mockResolvedValue({
      costPrice: 90,
      sellingPrice: 180,
    });

    const price = await service.resolveLinePrice(tx(prisma), 'prod-1', 1);

    expect(price).toEqual({ costPrice: 90, sellingPrice: 180 });
  });
});

describe('InventoryService.restockToBatches', () => {
  let prisma: MockPrisma;
  let service: InventoryService;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new InventoryService(prisma as unknown as PrismaService);
    prisma.product.update.mockResolvedValue({
      id: 'prod-1',
      currentStock: 10,
    });
    prisma.saleItem.findUniqueOrThrow.mockResolvedValue({
      id: 'item-1',
      productId: 'prod-1',
      unitPrice: 200,
    });
  });

  it('resumes at the right offset when earlier refunds already restocked part of the line', async () => {
    // Original sale line drew 5 from batch A then 3 from batch B.
    prisma.saleItemBatch.findMany.mockResolvedValue([
      { batchId: 'batch-a', quantity: 5, createdAt: new Date('2026-01-01') },
      { batchId: 'batch-b', quantity: 3, createdAt: new Date('2026-01-02') },
    ]);

    // An earlier refund already restocked all 5 of batch A; this refund of 2
    // must resume inside batch B rather than re-touching batch A.
    await service.restockToBatches(tx(prisma), {
      saleItemId: 'item-1',
      quantity: 2,
      alreadyRefunded: 5,
      userId: 'user-1',
    });

    expect(prisma.stockBatch.update).toHaveBeenCalledTimes(1);
    expect(prisma.stockBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-b' },
      data: { remainingQuantity: { increment: 2 } },
    });
  });

  it('falls back to a fresh untracked batch when there is no consumption record for the line', async () => {
    prisma.saleItemBatch.findMany.mockResolvedValue([]);
    prisma.product.findUniqueOrThrow.mockResolvedValue({
      id: 'prod-1',
      costPrice: 80,
    });
    prisma.stockBatch.create.mockResolvedValue({ id: 'new-batch' });

    await service.restockToBatches(tx(prisma), {
      saleItemId: 'item-1',
      quantity: 4,
      alreadyRefunded: 0,
      userId: 'user-1',
    });

    expect(prisma.stockBatch.create).toHaveBeenCalledWith({
      data: {
        productId: 'prod-1',
        quantity: 4,
        remainingQuantity: 4,
        costPrice: 80,
        sellingPrice: 200, // mirrors what the sale item actually charged
        expiryDate: null,
        reason: undefined,
        createdById: 'user-1',
      },
    });
  });
});
