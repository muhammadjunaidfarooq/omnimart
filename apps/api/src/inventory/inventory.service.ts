import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertValidQuantity, toNumber } from '../common/utils/decimal.util';
import {
  InventoryQueryDto,
  InventorySortField,
} from './dto/inventory-query.dto';
import {
  ExpiryQueryDto,
  ExpirySortField,
  ExpiryStatusFilter,
} from './dto/expiry-query.dto';
import { UpdateStockBatchDto } from './dto/update-stock-batch.dto';
import { BulkMinimumStockDto } from './dto/bulk-minimum-stock.dto';
import { BulkStockInDto } from './dto/bulk-stock-in.dto';
import { BulkAdjustDto } from './dto/bulk-adjust.dto';

interface RecordMovementParams {
  productId: string;
  type: StockMovementType;
  /** Signed delta applied to currentStock (positive = increase, negative = decrease) */
  quantity: number;
  reason?: string;
  userId: string;
  /** The batch this delta belongs to — omitted only for movements with no batch concept (there are none anymore, but kept optional so old rows stay valid) */
  batchId?: string;
}

interface ReceiveStockParams {
  productId: string;
  type: StockMovementType;
  /** Positive quantity being received into a brand-new batch */
  quantity: number;
  /** Captured on the new batch — callers default these to the product's current price when not overriding */
  costPrice: number;
  sellingPrice: number;
  expiryDate?: Date | null;
  reason?: string;
  userId: string;
}

export interface ActivePrice {
  costPrice: number;
  sellingPrice: number;
}

/** One product's non-depleted batch, FEFO-ordered — enough for a caller to price any quantity itself (see getPriceBatches). */
export interface PriceBatch {
  remainingQuantity: number;
  costPrice: number;
  sellingPrice: number;
}

interface ConsumeFefoParams {
  productId: string;
  type: StockMovementType;
  /** Positive quantity to draw down across batches, earliest-expiry first */
  quantity: number;
  reason?: string;
  userId: string;
  /** When set, records which batch(es) this sale line drew from, so a refund can restock precisely */
  saleItemId?: string;
}

interface RestockToBatchesParams {
  saleItemId: string;
  /** Positive quantity being refunded back for this sale line */
  quantity: number;
  /** Quantity already refunded for this sale line by earlier refunds — used to resume at the right batch offset */
  alreadyRefunded: number;
  reason?: string;
  userId: string;
}

/** FEFO ordering: earliest expiry first, batches with no expiry last, tie-broken by receipt order */
const FEFO_ORDER: Prisma.StockBatchOrderByWithRelationInput[] = [
  { expiryDate: { sort: 'asc', nulls: 'last' } },
  { createdAt: 'asc' },
];

const PRODUCT_INCLUDE = {
  category: true,
  brand: true,
  unit: true,
} satisfies Prisma.ProductInclude;

const STATUS_FILTER_MAP: Record<Exclude<ExpiryStatusFilter, 'all'>, string> = {
  expired: 'EXPIRED',
  expiring_soon: 'EXPIRING_SOON',
  good: 'GOOD',
};

/** Defaults to name ascending — every other column stays sortable via sortBy/sortOrder. */
function inventorySortOrder(
  sortBy: InventorySortField | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): Prisma.ProductOrderByWithRelationInput {
  const order = sortOrder ?? 'asc';
  switch (sortBy) {
    case 'sku':
      return { sku: order };
    case 'currentStock':
      return { currentStock: order };
    case 'minimumStockLevel':
      return { minimumStockLevel: order };
    case 'name':
    default:
      return { name: order };
  }
}

/** Re-sorts the cross-product expiry overview by a clicked column — see getExpiryOverview. */
function sortExpiryBatches<
  T extends {
    remainingQuantity: Prisma.Decimal | number;
    expiryDate: Date | null;
    product: { name: string; sku: string };
  },
>(
  batches: T[],
  sortBy: ExpirySortField,
  sortOrder: 'asc' | 'desc' | undefined,
): T[] {
  const dir = sortOrder === 'desc' ? -1 : 1;
  return [...batches].sort((a, b) => {
    switch (sortBy) {
      case 'product':
        return a.product.name.localeCompare(b.product.name) * dir;
      case 'sku':
        return a.product.sku.localeCompare(b.product.sku) * dir;
      case 'remainingQuantity':
        return (
          (toNumber(a.remainingQuantity) - toNumber(b.remainingQuantity)) * dir
        );
      case 'expiryDate':
      default:
        return (
          ((a.expiryDate?.getTime() ?? 0) - (b.expiryDate?.getTime() ?? 0)) *
          dir
        );
    }
  });
}

/** Same fields as inventorySortOrder, but for the low-stock branch's in-memory list (Prisma can't filter it directly — see findAll). */
function sortProductsInMemory<
  T extends {
    name: string;
    sku: string;
    currentStock: Prisma.Decimal | number;
    minimumStockLevel: Prisma.Decimal | number;
  },
>(
  products: T[],
  sortBy: InventorySortField | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): T[] {
  const dir = sortOrder === 'desc' ? -1 : 1;
  return [...products].sort((a, b) => {
    switch (sortBy) {
      case 'sku':
        return a.sku.localeCompare(b.sku) * dir;
      case 'currentStock':
        return (toNumber(a.currentStock) - toNumber(b.currentStock)) * dir;
      case 'minimumStockLevel':
        return (
          (toNumber(a.minimumStockLevel) - toNumber(b.minimumStockLevel)) * dir
        );
      case 'name':
      default:
        return a.name.localeCompare(b.name) * dir;
    }
  });
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The only sanctioned way to change Product.currentStock. Writes an
   * append-only ledger entry and applies the delta in the same transaction.
   */
  async recordMovement(
    tx: Prisma.TransactionClient,
    params: RecordMovementParams,
  ) {
    if (params.quantity === 0) {
      throw new BadRequestException('Stock movement quantity cannot be zero');
    }

    const product = await tx.product.update({
      where: { id: params.productId },
      data: { currentStock: { increment: params.quantity } },
    });

    if (toNumber(product.currentStock) < 0) {
      throw new BadRequestException(
        'Stock movement would result in negative stock',
      );
    }

    await tx.stockMovement.create({
      data: {
        productId: params.productId,
        type: params.type,
        quantity: params.quantity,
        reason: params.reason,
        userId: params.userId,
        batchId: params.batchId,
      },
    });

    return product;
  }

  /**
   * Creates a brand-new batch (with its own expiry date) and records the
   * matching ledger entry. Used whenever stock is freshly received — stock-in,
   * a positive adjustment, or a product's initial stock.
   */
  async receiveStock(tx: Prisma.TransactionClient, params: ReceiveStockParams) {
    const batch = await tx.stockBatch.create({
      data: {
        productId: params.productId,
        quantity: params.quantity,
        remainingQuantity: params.quantity,
        costPrice: params.costPrice,
        sellingPrice: params.sellingPrice,
        expiryDate: params.expiryDate ?? null,
        reason: params.reason,
        createdById: params.userId,
      },
    });

    await this.recordMovement(tx, {
      productId: params.productId,
      type: params.type,
      quantity: params.quantity,
      reason: params.reason,
      userId: params.userId,
      batchId: batch.id,
    });

    return batch;
  }

  /**
   * Draws down a product's batches earliest-expiry-first (FEFO) until
   * `quantity` is satisfied, writing one ledger entry per batch touched.
   * Used by checkout (type OUT) and negative adjustments (type ADJUSTMENT).
   */
  async consumeFefo(tx: Prisma.TransactionClient, params: ConsumeFefoParams) {
    const batches = await tx.stockBatch.findMany({
      where: { productId: params.productId, remainingQuantity: { gt: 0 } },
      orderBy: FEFO_ORDER,
    });

    const totalAvailable = batches.reduce(
      (sum, b) => sum + toNumber(b.remainingQuantity),
      0,
    );
    if (totalAvailable < params.quantity) {
      throw new BadRequestException(
        'Stock movement would result in negative stock',
      );
    }

    let remaining = params.quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(toNumber(batch.remainingQuantity), remaining);
      if (take <= 0) continue;

      await tx.stockBatch.update({
        where: { id: batch.id },
        data: { remainingQuantity: { decrement: take } },
      });
      await this.recordMovement(tx, {
        productId: params.productId,
        type: params.type,
        quantity: -take,
        reason: params.reason,
        userId: params.userId,
        batchId: batch.id,
      });
      if (params.saleItemId) {
        await tx.saleItemBatch.create({
          data: {
            saleItemId: params.saleItemId,
            batchId: batch.id,
            quantity: take,
          },
        });
      }
      remaining -= take;
    }
  }

  /**
   * The price a sale line for `quantity` units of `productId` should charge:
   * walks batches in FEFO order accumulating remaining stock until it would
   * cover the full quantity, and returns *that* batch's price for the whole
   * line — old stock keeps its old price until fully depleted, and once a
   * line's quantity spills into a newer-priced batch, the whole line prices
   * at the new batch rather than blending unit prices. Falls back to the
   * product's own current price when no batch covers the full quantity
   * (out of stock, or no batches exist yet) — consumeFefo separately
   * rejects the sale if there's genuinely not enough stock.
   *
   * IMPORTANT: this is the same accumulation the frontend cart preview
   * mirrors (see `pickPriceForQuantity` in apps/web/src/lib/sales-calc.ts)
   * against the `priceBatches` this product was listed with — keep the two
   * in sync, or a cashier's on-screen total can silently stop matching what
   * checkout actually charges once a line spans a batch boundary.
   */
  async resolveLinePrice(
    tx: Prisma.TransactionClient,
    productId: string,
    quantity: number,
  ): Promise<ActivePrice> {
    const batches = await tx.stockBatch.findMany({
      where: { productId, remainingQuantity: { gt: 0 } },
      orderBy: FEFO_ORDER,
    });

    let remaining = quantity;
    for (const batch of batches) {
      remaining -= toNumber(batch.remainingQuantity);
      if (remaining <= 0) {
        return { costPrice: batch.costPrice, sellingPrice: batch.sellingPrice };
      }
    }

    const product = await tx.product.findUniqueOrThrow({
      where: { id: productId },
    });
    return { costPrice: product.costPrice, sellingPrice: product.sellingPrice };
  }

  /**
   * Each product's non-depleted batches, FEFO-ordered, with just enough to
   * price any quantity: the frontend cart preview replays the exact same
   * "accumulate until it covers the quantity" logic as `resolveLinePrice`
   * against this list, so what a cashier sees before checkout always
   * matches what checkout will actually charge — including once a line's
   * quantity spans more than one batch.
   */
  async getPriceBatches(
    productIds: string[],
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Map<string, PriceBatch[]>> {
    if (productIds.length === 0) return new Map();

    const batches = await client.stockBatch.findMany({
      where: { productId: { in: productIds }, remainingQuantity: { gt: 0 } },
      orderBy: FEFO_ORDER,
      select: {
        productId: true,
        remainingQuantity: true,
        costPrice: true,
        sellingPrice: true,
      },
    });

    const result = new Map<string, PriceBatch[]>();
    for (const batch of batches) {
      const list = result.get(batch.productId) ?? [];
      list.push({
        remainingQuantity: toNumber(batch.remainingQuantity),
        costPrice: batch.costPrice,
        sellingPrice: batch.sellingPrice,
      });
      result.set(batch.productId, list);
    }
    return result;
  }

  /**
   * Each product's actual stock value: its non-depleted batches valued at
   * their own recorded cost, plus — for stock quantity not covered by any
   * batch (e.g. pre-dating batch tracking) — that leftover valued at the
   * product's own cost price, the same fallback `resolveLinePrice` uses.
   * This is what "Stock Value" should always be read from; `Product.costPrice`
   * alone understates it once stock has been received at a different price
   * than the product's default (see `receiveStock`, which prices the new
   * batch but deliberately leaves `Product.costPrice` untouched).
   */
  async attachStockValues<
    T extends {
      id: string;
      currentStock: Prisma.Decimal | number;
      costPrice: number;
    },
  >(products: T[]): Promise<(T & { stockValue: number })[]> {
    const priceBatches = await this.getPriceBatches(products.map((p) => p.id));

    return products.map((p) => {
      const batches = priceBatches.get(p.id) ?? [];
      const batchQty = batches.reduce((sum, b) => sum + b.remainingQuantity, 0);
      const batchValue = batches.reduce(
        (sum, b) => sum + b.remainingQuantity * b.costPrice,
        0,
      );
      const untrackedQty = Math.max(toNumber(p.currentStock) - batchQty, 0);
      return {
        ...p,
        stockValue: Math.round(batchValue + untrackedQty * p.costPrice),
      };
    });
  }

  /**
   * The currently-active price per product — the earliest non-depleted
   * batch's price (falling back to the product's own price when it has no
   * batches).
   */
  async getActivePrices(
    productIds: string[],
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Map<string, ActivePrice>> {
    if (productIds.length === 0) return new Map();

    const [products, priceBatches] = await Promise.all([
      client.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, costPrice: true, sellingPrice: true },
      }),
      this.getPriceBatches(productIds, client),
    ]);

    const result = new Map<string, ActivePrice>();
    for (const product of products) {
      const activeBatch = priceBatches.get(product.id)?.[0];
      result.set(product.id, {
        costPrice: activeBatch?.costPrice ?? product.costPrice,
        sellingPrice: activeBatch?.sellingPrice ?? product.sellingPrice,
      });
    }
    return result;
  }

  /**
   * Restocks a refunded quantity back into the exact batch(es) the original
   * sale line drew from (recorded by consumeFefo as SaleItemBatch rows),
   * resuming after whatever earlier refunds on the same line already
   * restocked. Any leftover (e.g. a sale line predating batch tracking)
   * falls back to a fresh no-expiry batch so refunded stock is never lost.
   */
  async restockToBatches(
    tx: Prisma.TransactionClient,
    params: RestockToBatchesParams,
  ) {
    const saleItem = await tx.saleItem.findUniqueOrThrow({
      where: { id: params.saleItemId },
    });
    const consumptions = await tx.saleItemBatch.findMany({
      where: { saleItemId: params.saleItemId },
      orderBy: { createdAt: 'asc' },
    });

    let skip = params.alreadyRefunded;
    let remaining = params.quantity;
    for (const consumption of consumptions) {
      if (remaining <= 0) break;
      let available = toNumber(consumption.quantity);
      if (skip > 0) {
        const skipped = Math.min(skip, available);
        skip -= skipped;
        available -= skipped;
      }
      if (available <= 0) continue;
      const take = Math.min(available, remaining);

      await tx.stockBatch.update({
        where: { id: consumption.batchId },
        data: { remainingQuantity: { increment: take } },
      });
      await this.recordMovement(tx, {
        productId: saleItem.productId,
        type: StockMovementType.IN,
        quantity: take,
        reason: params.reason,
        userId: params.userId,
        batchId: consumption.batchId,
      });
      remaining -= take;
    }

    if (remaining > 0) {
      // No batch to attribute this leftover to (e.g. a sale line predating
      // batch tracking) — sellingPrice mirrors what was actually charged;
      // costPrice falls back to the product's current cost, the best
      // available estimate since no historical batch cost was recorded.
      const product = await tx.product.findUniqueOrThrow({
        where: { id: saleItem.productId },
      });
      await this.receiveStock(tx, {
        productId: saleItem.productId,
        type: StockMovementType.IN,
        quantity: remaining,
        costPrice: product.costPrice,
        sellingPrice: saleItem.unitPrice,
        expiryDate: null,
        reason: params.reason
          ? `${params.reason} (untracked remainder)`
          : undefined,
        userId: params.userId,
      });
    }
  }

  async stockIn(
    productId: string,
    quantity: number,
    reason: string | undefined,
    userId: string,
    expiryDate?: Date,
    costPrice?: number,
    sellingPrice?: number,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { unit: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    assertValidQuantity(
      quantity,
      product.unit.allowsFractionalQuantity,
      'Quantity',
    );

    return this.prisma.$transaction(async (tx) => {
      await this.receiveStock(tx, {
        productId,
        type: StockMovementType.IN,
        quantity,
        costPrice: costPrice ?? product.costPrice,
        sellingPrice: sellingPrice ?? product.sellingPrice,
        expiryDate,
        reason,
        userId,
      });
      return tx.product.findUniqueOrThrow({ where: { id: productId } });
    });
  }

  async adjust(
    productId: string,
    quantity: number,
    reason: string,
    userId: string,
    expiryDate?: Date,
    costPrice?: number,
    sellingPrice?: number,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { unit: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    // quantity === 0 means the stock count itself is correct and only the
    // recorded cost/selling price was wrong — correct the product's price
    // directly instead of going through the stock ledger, which only tracks
    // quantity deltas and rejects a zero movement.
    if (quantity === 0) {
      if (costPrice === undefined && sellingPrice === undefined) {
        throw new BadRequestException(
          'Provide a non-zero quantity, or a corrected cost/selling price',
        );
      }
      return this.prisma.product.update({
        where: { id: productId },
        data: {
          ...(costPrice !== undefined && { costPrice }),
          ...(sellingPrice !== undefined && { sellingPrice }),
        },
      });
    }

    assertValidQuantity(
      quantity,
      product.unit.allowsFractionalQuantity,
      'Quantity',
    );

    return this.prisma.$transaction(async (tx) => {
      if (quantity > 0) {
        await this.receiveStock(tx, {
          productId,
          type: StockMovementType.ADJUSTMENT,
          quantity,
          costPrice: costPrice ?? product.costPrice,
          sellingPrice: sellingPrice ?? product.sellingPrice,
          expiryDate,
          reason,
          userId,
        });
      } else {
        await this.consumeFefo(tx, {
          productId,
          type: StockMovementType.ADJUSTMENT,
          quantity: -quantity,
          reason,
          userId,
        });
      }
      return tx.product.findUniqueOrThrow({ where: { id: productId } });
    });
  }

  /**
   * Corrects a data-entry mistake on an already-existing batch — e.g. the
   * received quantity or a price was typed wrong. Unlike stockIn/adjust,
   * every field here is the batch's new absolute value, not a delta. A
   * changed remainingQuantity still goes through recordMovement (so
   * Product.currentStock and the StockMovement ledger stay correct) — the
   * batch's own reason (why it was received) is left untouched; the
   * correction's reason lives on the ledger entry instead.
   */
  async updateBatch(
    productId: string,
    batchId: string,
    dto: UpdateStockBatchDto,
    userId: string,
  ) {
    const [product, batch] = await Promise.all([
      this.prisma.product.findUnique({
        where: { id: productId },
        include: { unit: true },
      }),
      this.prisma.stockBatch.findUnique({ where: { id: batchId } }),
    ]);
    if (!product) throw new NotFoundException('Product not found');
    if (!batch || batch.productId !== productId) {
      throw new NotFoundException('Stock batch not found');
    }

    const newQuantity = dto.quantity ?? toNumber(batch.quantity);
    const newRemaining =
      dto.remainingQuantity ?? toNumber(batch.remainingQuantity);
    assertValidQuantity(
      newQuantity,
      product.unit.allowsFractionalQuantity,
      'Received quantity',
    );
    assertValidQuantity(
      newRemaining,
      product.unit.allowsFractionalQuantity,
      'Remaining quantity',
    );
    if (newRemaining > newQuantity) {
      throw new BadRequestException(
        'Remaining quantity cannot exceed received quantity',
      );
    }

    const remainingDelta = newRemaining - toNumber(batch.remainingQuantity);

    return this.prisma.$transaction(async (tx) => {
      if (remainingDelta !== 0) {
        await this.recordMovement(tx, {
          productId,
          type: StockMovementType.ADJUSTMENT,
          quantity: remainingDelta,
          reason: dto.reason,
          userId,
          batchId,
        });
      }

      return tx.stockBatch.update({
        where: { id: batchId },
        data: {
          quantity: newQuantity,
          remainingQuantity: newRemaining,
          ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
          ...(dto.sellingPrice !== undefined && {
            sellingPrice: dto.sellingPrice,
          }),
          ...(dto.expiryDate !== undefined && {
            expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          }),
        },
        include: { createdBy: { select: { id: true, name: true } } },
      });
    });
  }

  /** Applies the same reorder threshold to many products in one shot — a plain Product field, no ledger involvement. */
  async bulkSetMinimumStock(dto: BulkMinimumStockDto) {
    const result = await this.prisma.product.updateMany({
      where: { id: { in: dto.ids } },
      data: { minimumStockLevel: dto.minimumStockLevel },
    });
    return { updated: result.count };
  }

  /**
   * Receives the same quantity into a fresh batch for many products at
   * once, reusing the single-product stockIn for each — so every batch/
   * ledger rule (FEFO, unit fractional-quantity enforcement) applies
   * exactly as it would one at a time. A product stockIn rejects (e.g. a
   * fractional quantity on a whole-number-only unit) is skipped rather than
   * failing the whole batch.
   */
  async bulkStockIn(dto: BulkStockInDto, userId: string) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true, name: true },
    });

    const skipped: { id: string; name: string; reason: string }[] = [];
    let succeeded = 0;
    for (const product of products) {
      try {
        await this.stockIn(
          product.id,
          dto.quantity,
          dto.reason,
          userId,
          dto.expiryDate ? new Date(dto.expiryDate) : undefined,
          dto.costPrice,
          dto.sellingPrice,
        );
        succeeded += 1;
      } catch (error) {
        skipped.push({
          id: product.id,
          name: product.name,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return { succeeded, skipped };
  }

  /**
   * Applies the same signed adjustment to many products at once, reusing
   * the single-product adjust for each (see bulkStockIn for why). A product
   * this delta can't apply to — e.g. removing more than it has in stock —
   * is skipped rather than failing the whole batch.
   */
  async bulkAdjust(dto: BulkAdjustDto, userId: string) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true, name: true },
    });

    const skipped: { id: string; name: string; reason: string }[] = [];
    let succeeded = 0;
    for (const product of products) {
      try {
        await this.adjust(product.id, dto.quantity, dto.reason, userId);
        succeeded += 1;
      } catch (error) {
        skipped.push({
          id: product.id,
          name: product.name,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return { succeeded, skipped };
  }

  async findAll(query: InventoryQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const searchWhere: Prisma.ProductWhereInput = {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.excludeHiddenCategories
        ? { category: { hiddenFromPos: false } }
        : {}),
    };

    const orderBy = inventorySortOrder(query.sortBy, query.sortOrder);

    // Out-of-stock: Prisma can express this directly
    if (query.stockStatus === 'out') {
      const where: Prisma.ProductWhereInput = {
        ...searchWhere,
        currentStock: 0,
      };
      const [items, total] = await this.prisma.$transaction([
        this.prisma.product.findMany({
          where,
          include: PRODUCT_INCLUDE,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
        this.prisma.product.count({ where }),
      ]);
      return {
        items: await this.attachStockValues(items),
        total,
        page,
        pageSize,
      };
    }

    // Low-stock: currentStock > 0 AND currentStock <= minimumStockLevel
    // Prisma does not support field-to-field comparisons, so we fetch non-zero
    // stock items and filter/sort in JS. Product catalogs are small for this MVP.
    if (query.stockStatus === 'low') {
      const all = await this.prisma.product.findMany({
        where: { ...searchWhere, currentStock: { gt: 0 } },
        include: PRODUCT_INCLUDE,
      });
      const low = sortProductsInMemory(
        all.filter(
          (p) => toNumber(p.currentStock) <= toNumber(p.minimumStockLevel),
        ),
        query.sortBy,
        query.sortOrder,
      );
      const pageItems = low.slice((page - 1) * pageSize, page * pageSize);
      return {
        items: await this.attachStockValues(pageItems),
        total: low.length,
        page,
        pageSize,
      };
    }

    // All products
    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where: searchWhere,
        include: PRODUCT_INCLUDE,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where: searchWhere }),
    ]);
    return {
      items: await this.attachStockValues(items),
      total,
      page,
      pageSize,
    };
  }

  async getSummary() {
    const [outOfStockCount, allProducts] = await this.prisma.$transaction([
      this.prisma.product.count({ where: { currentStock: 0 } }),
      this.prisma.product.findMany({
        select: {
          id: true,
          currentStock: true,
          costPrice: true,
          minimumStockLevel: true,
        },
      }),
    ]);

    const lowStockCount = allProducts.filter((p) => {
      const currentStock = toNumber(p.currentStock);
      return currentStock > 0 && currentStock <= toNumber(p.minimumStockLevel);
    }).length;

    const withStockValue = await this.attachStockValues(allProducts);
    const totalStockValue = withStockValue.reduce(
      (sum, p) => sum + p.stockValue,
      0,
    );

    return { outOfStockCount, lowStockCount, totalStockValue };
  }

  async getMovements(productId: string, page = 1, pageSize = 20) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where: { productId },
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.stockMovement.count({ where: { productId } }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * A batch expiring within `warningDays` of today is EXPIRING_SOON rather
   * than GOOD; a batch with no expiry date never carries an expiry status.
   */
  private computeExpiryStatus(
    expiryDate: Date | null,
    warningDays: number,
  ): 'EXPIRED' | 'EXPIRING_SOON' | 'GOOD' | 'NO_EXPIRY' {
    if (!expiryDate) return 'NO_EXPIRY';

    const now = new Date();
    if (expiryDate < now) return 'EXPIRED';

    const warningCutoff = new Date(now);
    warningCutoff.setUTCDate(warningCutoff.getUTCDate() + warningDays);
    return expiryDate <= warningCutoff ? 'EXPIRING_SOON' : 'GOOD';
  }

  /**
   * A single product's non-depleted batches, soonest-expiring first — powers
   * the batch-list dialog on the Inventory page. Fully-sold-through batches
   * are omitted (nothing left to act on, and showing them next to active
   * ones was reported as confusing) — the full historical ledger, depleted
   * batches included, remains available via getMovements.
   */
  async getBatches(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Product not found');

    const [settings, batches] = await Promise.all([
      this.prisma.businessSettings.findUniqueOrThrow({ where: { id: 1 } }),
      this.prisma.stockBatch.findMany({
        where: { productId, remainingQuantity: { gt: 0 } },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: FEFO_ORDER,
      }),
    ]);

    return batches.map((batch) => ({
      ...batch,
      status: this.computeExpiryStatus(
        batch.expiryDate,
        settings.expiryWarningDays,
      ),
    }));
  }

  /**
   * Cross-product batch listing, soonest-expiring first — powers the shared
   * Expiry view for both Admin and Cashier. Only batches with a set expiry
   * date and remaining stock are included; a batch with no expiry date isn't
   * meaningfully "expiring" so it has no place in this view.
   */
  async getExpiryOverview(query: ExpiryQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const [settings, batches] = await Promise.all([
      this.prisma.businessSettings.findUniqueOrThrow({ where: { id: 1 } }),
      this.prisma.stockBatch.findMany({
        where: {
          remainingQuantity: { gt: 0 },
          expiryDate: { not: null },
          ...(query.search
            ? {
                product: {
                  OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { sku: { contains: query.search, mode: 'insensitive' } },
                  ],
                },
              }
            : {}),
        },
        include: { product: { include: PRODUCT_INCLUDE } },
        orderBy: FEFO_ORDER,
      }),
    ]);

    const withStatus = batches.map((batch) => ({
      ...batch,
      status: this.computeExpiryStatus(
        batch.expiryDate,
        settings.expiryWarningDays,
      ),
    }));

    const filtered =
      query.status && query.status !== 'all'
        ? withStatus.filter(
            (b) => b.status === STATUS_FILTER_MAP[query.status!],
          )
        : withStatus;

    // Defaults to the FEFO order the list was fetched in (soonest-expiry
    // first); an explicit sortBy re-sorts by whichever column was clicked.
    const sorted = query.sortBy
      ? sortExpiryBatches(filtered, query.sortBy, query.sortOrder)
      : filtered;

    return {
      items: sorted.slice((page - 1) * pageSize, page * pageSize),
      total: sorted.length,
      page,
      pageSize,
    };
  }
}
