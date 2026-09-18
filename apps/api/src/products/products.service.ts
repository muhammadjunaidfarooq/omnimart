import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService, PriceBatch } from '../inventory/inventory.service';
import { SkuService } from '../sku/sku.service';
import { BulkCategoryDto } from './dto/bulk-category.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { BulkPriceDto } from './dto/bulk-price.dto';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto, ProductSortField } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const PRODUCT_INCLUDE = {
  category: true,
  brand: true,
  unit: true,
} satisfies Prisma.ProductInclude;

/** Defaults to name ascending — every other column stays sortable via sortBy/sortOrder. */
function productSortOrder(
  sortBy: ProductSortField | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): Prisma.ProductOrderByWithRelationInput {
  const order = sortOrder ?? 'asc';
  switch (sortBy) {
    case 'sku':
      return { sku: order };
    case 'category':
      return { category: { name: order } };
    case 'sellingPrice':
      return { sellingPrice: order };
    case 'currentStock':
      return { currentStock: order };
    case 'createdAt':
      return { createdAt: order };
    case 'name':
    default:
      return { name: order };
  }
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly skuService: SkuService,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(dto: CreateProductDto, userId: string) {
    const { initialStock, initialStockExpiryDate, ...productData } = dto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const sku = await this.skuService.nextSku(tx);

        const product = await tx.product.create({
          data: { ...productData, sku },
        });

        if (initialStock && initialStock > 0) {
          await this.inventoryService.receiveStock(tx, {
            productId: product.id,
            type: StockMovementType.IN,
            quantity: initialStock,
            costPrice: product.costPrice,
            sellingPrice: product.sellingPrice,
            expiryDate: initialStockExpiryDate
              ? new Date(initialStockExpiryDate)
              : undefined,
            reason: 'Initial stock on product creation',
            userId,
          });
        }

        return tx.product.findUniqueOrThrow({
          where: { id: product.id },
          include: PRODUCT_INCLUDE,
        });
      });
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  /**
   * Clones a product's catalog details under a fresh, server-generated SKU —
   * everything except SKU, name (suffixed so it's obviously a copy), and
   * stock, which starts at 0 like any other new product: stock is never
   * fabricated, it must always come from an actual stock-in.
   */
  async duplicate(id: string) {
    const source = await this.prisma.product.findUnique({ where: { id } });
    if (!source) {
      throw new NotFoundException('Product not found');
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const sku = await this.skuService.nextSku(tx);

        const product = await tx.product.create({
          data: {
            sku,
            name: `${source.name} (Copy)`,
            description: source.description,
            imageUrl: source.imageUrl,
            categoryId: source.categoryId,
            brandId: source.brandId,
            unitId: source.unitId,
            costPrice: source.costPrice,
            sellingPrice: source.sellingPrice,
            taxRateBps: source.taxRateBps,
            discountType: source.discountType,
            discountValue: source.discountValue,
            minimumStockLevel: source.minimumStockLevel,
            isActive: source.isActive,
          },
        });

        return tx.product.findUniqueOrThrow({
          where: { id: product.id },
          include: PRODUCT_INCLUDE,
        });
      });
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  /**
   * Attaches each product's currently-active batch price plus its full
   * ordered `priceBatches` list — additive fields only, so `costPrice`/
   * `sellingPrice` keep meaning "the default price new batches start from"
   * everywhere else (catalog edit form, stock-value calc).
   *
   * `priceBatches` matters beyond just showing today's price: the cart
   * preview (apps/web/src/lib/sales-calc.ts) replays the same "accumulate
   * until it covers the quantity" logic checkout uses
   * (InventoryService.resolveLinePrice) against this list, so a line that
   * spans a batch boundary previews at the correct price instead of the
   * flat "active" price alone, which would only ever reflect the first
   * batch and could undercharge what checkout actually bills.
   */
  private async attachActivePrices<
    T extends { id: string; costPrice: number; sellingPrice: number },
  >(
    products: T[],
  ): Promise<
    (T & {
      activeCostPrice: number;
      activeSellingPrice: number;
      priceBatches: PriceBatch[];
    })[]
  > {
    const priceBatches = await this.inventoryService.getPriceBatches(
      products.map((p) => p.id),
    );
    return products.map((product) => {
      const batches = priceBatches.get(product.id) ?? [];
      const active = batches[0];
      return {
        ...product,
        activeCostPrice: active?.costPrice ?? product.costPrice,
        activeSellingPrice: active?.sellingPrice ?? product.sellingPrice,
        priceBatches: batches,
      };
    });
  }

  /**
   * Every active product, unpaginated and grouped by category — powers the
   * admin "Download Price List" print page, which needs the whole catalog
   * at once rather than a page at a time.
   */
  async findAllForPriceList() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: PRODUCT_INCLUDE,
      orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    });
    return this.attachActivePrices(products);
  }

  /** `excludeHiddenCategories` drops products whose category is hiddenFromPos — pass true for the cashier-facing POS, false for admin management. */
  async findAll(query: ProductQueryDto, excludeHiddenCategories = false) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.ProductWhereInput = {
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.stockStatus === 'out' ? { currentStock: 0 } : {}),
      ...(excludeHiddenCategories
        ? { category: { hiddenFromPos: false } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: productSortOrder(query.sortBy, query.sortOrder),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items: await this.attachActivePrices(items),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const [withActivePrice] = await this.attachActivePrices([product]);
    return withActivePrice;
  }

  async update(id: string, dto: UpdateProductDto) {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: dto,
        include: PRODUCT_INCLUDE,
      });
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  /**
   * Hard-deletes a product. A product with any sales, stock movements, or
   * batches against it can't be removed (FK constraint) — deactivating it
   * via updateStatus is the right move there, so that history stays intact.
   */
  async remove(id: string) {
    try {
      await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Product not found');
        }
        if (error.code === 'P2003') {
          throw new ConflictException(
            'Cannot delete a product with sales or stock history — deactivate it instead',
          );
        }
      }
      throw error;
    }
  }

  /** Reassigns many products to a category and/or brand in one shot. */
  async bulkUpdateCategory(dto: BulkCategoryDto) {
    if (!dto.categoryId && !dto.brandId) {
      throw new BadRequestException(
        'Provide a category or brand to apply to the selected products',
      );
    }
    const result = await this.prisma.product.updateMany({
      where: { id: { in: dto.ids } },
      data: {
        ...(dto.categoryId && { categoryId: dto.categoryId }),
        ...(dto.brandId && { brandId: dto.brandId }),
      },
    });
    return { updated: result.count };
  }

  /** Activates or deactivates many products in one shot. */
  async bulkUpdateStatus(dto: BulkStatusDto) {
    const result = await this.prisma.product.updateMany({
      where: { id: { in: dto.ids } },
      data: { isActive: dto.isActive },
    });
    return { updated: result.count };
  }

  /**
   * Re-prices many products' Product.sellingPrice in one shot — same field
   * the single-product edit form writes to. Never touches existing stock
   * batches' own locked-in price (see receiveStock) — those keep selling at
   * whatever price they were received at until depleted, exactly like a
   * single-product price edit already does.
   */
  async bulkUpdatePrice(dto: BulkPriceDto) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true, sellingPrice: true },
    });

    const updates = products.map((product) => {
      let newPrice: number;
      switch (dto.mode) {
        case 'SET':
          newPrice = dto.value;
          break;
        case 'PERCENT':
          newPrice = product.sellingPrice * (1 + dto.value / 100);
          break;
        case 'AMOUNT':
          newPrice = product.sellingPrice + dto.value;
          break;
      }
      return {
        id: product.id,
        sellingPrice: Math.max(0, Math.round(newPrice)),
      };
    });

    await this.prisma.$transaction(
      updates.map((u) =>
        this.prisma.product.update({
          where: { id: u.id },
          data: { sellingPrice: u.sellingPrice },
        }),
      ),
    );
    return { updated: updates.length };
  }

  /**
   * Deletes as many of the selected products as have no sales/stock history
   * — the rest are reported back as skipped rather than failing the whole
   * batch, same FK-conflict rule as the single-product remove().
   */
  async bulkDelete(dto: BulkDeleteDto) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.ids } },
      select: { id: true, name: true },
    });

    const skipped: { id: string; name: string }[] = [];
    let deletedCount = 0;
    for (const product of products) {
      try {
        await this.prisma.product.delete({ where: { id: product.id } });
        deletedCount += 1;
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2003'
        ) {
          skipped.push(product);
          continue;
        }
        throw error;
      }
    }
    return { deletedCount, skipped };
  }

  async updateStatus(id: string, isActive: boolean) {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { isActive },
        include: PRODUCT_INCLUDE,
      });
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  async setImage(id: string, imageUrl: string) {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { imageUrl },
        include: PRODUCT_INCLUDE,
      });
    } catch (error) {
      throw this.mapKnownError(error);
    }
  }

  private mapKnownError(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new ConflictException('A product with this SKU already exists');
      }
      if (error.code === 'P2003') {
        return new BadRequestException('Invalid category, brand, or unit');
      }
      if (error.code === 'P2025') {
        return new NotFoundException('Product not found');
      }
    }
    return error;
  }
}
