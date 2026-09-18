import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Borrower,
  BusinessSettings,
  DiscountType,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Product,
  Role,
  SaleStatus,
  StockMovementType,
  Unit,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  InventoryService,
  type ActivePrice,
} from '../inventory/inventory.service';
import { KhataService } from '../khata/khata.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import {
  enumerateDays,
  enumerateMonths,
  endOfDayExclusive,
  lastNDaysRange,
  lastNMonthsRange,
  resolveDateRange,
} from '../common/utils/date-range.util';
import { assertValidQuantity, toNumber } from '../common/utils/decimal.util';
import { saleFilterFields } from '../common/utils/sale-filter.util';
import { SaleItemDto } from './dto/sale-item.dto';
import { SaveDraftDto } from './dto/save-draft.dto';
import { CheckoutDto } from './dto/checkout.dto';
import {
  SalesHistoryQueryDto,
  SalesHistorySortField,
} from './dto/sales-history-query.dto';
import { CreateRefundDto } from './dto/create-refund.dto';

const INVOICE_PREFIX = 'INV-';
const INVOICE_PAD_LENGTH = 6;

const SALE_INCLUDE = {
  items: true,
  cashier: { select: { id: true, name: true } },
} satisfies Prisma.SaleInclude;

const SALE_DETAIL_INCLUDE = {
  ...SALE_INCLUDE,
  refunds: {
    include: {
      items: true,
      refundedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.SaleInclude;

interface ComputedLine {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  taxRateBps: number;
  discountType: DiscountType | null;
  discountValue: number | null;
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
}

interface ComputedSale {
  lines: ComputedLine[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  totalAmount: number;
}

/** Defaults to most-recent-first — every other column stays sortable via sortBy/sortOrder. */
function salesHistorySortOrder(
  sortBy: SalesHistorySortField | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): Prisma.SaleOrderByWithRelationInput {
  const order = sortOrder ?? (sortBy ? 'asc' : 'desc');
  switch (sortBy) {
    case 'invoiceNumber':
      return { invoiceNumber: order };
    case 'cashier':
      return { cashier: { name: order } };
    case 'paymentMethod':
      return { paymentMethod: order };
    case 'totalAmount':
      return { totalAmount: order };
    case 'completedAt':
    default:
      return { completedAt: order };
  }
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly khataService: KhataService,
  ) {}

  private computeLine(
    product: Product & { unit: Unit },
    item: SaleItemDto,
    settings: BusinessSettings,
    /** The active batch's cost/selling price for this line's quantity — see InventoryService.resolveLinePrice */
    activePrice: ActivePrice,
  ): ComputedLine {
    assertValidQuantity(
      item.quantity,
      product.unit.allowsFractionalQuantity,
      `Quantity for "${product.name}"`,
    );

    if (item.unitPriceOverride != null && item.lineTotalOverride != null) {
      throw new BadRequestException(
        `"${product.name}" cannot have both a unit price and a total price override`,
      );
    }

    // A cashier can charge a one-off price for this line — never persisted
    // back to the product — but never below what the stock actually cost.
    if (
      item.unitPriceOverride != null &&
      item.unitPriceOverride < activePrice.costPrice
    ) {
      throw new BadRequestException(
        `Price for "${product.name}" cannot be below its cost price`,
      );
    }
    // Same floor, but for a fixed total (e.g. a "3 for 50" bundle) — compared
    // against the cost of the whole line rather than a per-unit price.
    if (
      item.lineTotalOverride != null &&
      item.lineTotalOverride < activePrice.costPrice * item.quantity
    ) {
      throw new BadRequestException(
        `Total price for "${product.name}" cannot be below its cost price`,
      );
    }
    const sellingPrice = item.unitPriceOverride ?? activePrice.sellingPrice;

    // A cashier-chosen override always wins; otherwise the global discount
    // (when enabled) applies to every product instead of its own discount.
    const discountType =
      item.discountType ??
      (settings.globalDiscountEnabled
        ? settings.globalDiscountType
        : product.discountType);
    const discountValue = item.discountType
      ? (item.discountValue ?? 0)
      : settings.globalDiscountEnabled
        ? (settings.globalDiscountValue ?? 0)
        : (product.discountValue ?? 0);

    // A fixed total (e.g. a "3 for 50" bundle) replaces the usual
    // unitPrice × quantity math outright — it's the whole reason a cashier
    // reaches for it instead of unitPriceOverride: the tier price often
    // isn't a whole-cent unit price to begin with. Quantity may otherwise
    // be fractional (e.g. 0.25 kg); cents must stay integer either way.
    const lineSubtotal =
      item.lineTotalOverride ?? Math.round(sellingPrice * item.quantity);
    const rawDiscount =
      discountType === DiscountType.PERCENTAGE
        ? Math.round((lineSubtotal * discountValue) / 10000)
        : discountType === DiscountType.FIXED
          ? discountValue
          : 0;
    // Clamp so a FIXED discount larger than the line, or a PERCENTAGE over
    // 100%, can never push the line (and therefore the bill) negative.
    const lineDiscount = Math.min(rawDiscount, lineSubtotal);
    const taxable = lineSubtotal - lineDiscount;
    const lineTax = Math.round((taxable * product.taxRateBps) / 10000);
    const lineTotal = taxable + lineTax;

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: item.quantity,
      // Snapshot the implied average per-unit price when a fixed total was
      // used instead — lineSubtotal above stays exact either way; this is
      // for reporting/display only (e.g. per-unit revenue breakdowns).
      unitPrice:
        item.lineTotalOverride != null
          ? Math.round(item.lineTotalOverride / item.quantity)
          : sellingPrice,
      taxRateBps: product.taxRateBps,
      discountType: discountType ?? null,
      discountValue: discountType ? discountValue : null,
      lineSubtotal,
      lineDiscount,
      lineTax,
      lineTotal,
    };
  }

  private async computeSale(
    tx: Prisma.TransactionClient,
    items: SaleItemDto[],
  ): Promise<ComputedSale> {
    const [products, settings] = await Promise.all([
      tx.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        include: { unit: true },
      }),
      tx.businessSettings.findUniqueOrThrow({ where: { id: 1 } }),
    ]);
    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validated up front so a bad productId fails with the friendly errors
    // below, rather than surfacing as a batch-lookup error.
    const validated = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BadRequestException(`Product ${item.productId} not found`);
      }
      if (!product.isActive) {
        throw new BadRequestException(
          `Product "${product.name}" is not active`,
        );
      }
      return { item, product };
    });

    // Old stock keeps selling at its bought price until depleted — each
    // line prices from whichever batch is active for its quantity, not the
    // product's current price. See InventoryService.resolveLinePrice.
    const activePrices = await Promise.all(
      validated.map(({ item }) =>
        this.inventoryService.resolveLinePrice(
          tx,
          item.productId,
          item.quantity,
        ),
      ),
    );

    const lines = validated.map(({ item, product }, i) =>
      this.computeLine(product, item, settings, activePrices[i]),
    );

    const subtotal = lines.reduce((sum, l) => sum + l.lineSubtotal, 0);
    const discountTotal = lines.reduce((sum, l) => sum + l.lineDiscount, 0);
    const taxTotal = lines.reduce((sum, l) => sum + l.lineTax, 0);
    const totalAmount = lines.reduce((sum, l) => sum + l.lineTotal, 0);

    return { lines, subtotal, discountTotal, taxTotal, totalAmount };
  }

  /**
   * Atomically increments the singleton counter row and returns the next
   * invoice number. Must be called inside the same transaction as the sale
   * creation so a rolled-back checkout also rolls back the increment.
   */
  private async nextInvoiceNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const [{ lastValue }] = await tx.$queryRaw<{ lastValue: number }[]>`
      UPDATE "invoice_counters" SET "lastValue" = "lastValue" + 1 WHERE id = 1 RETURNING "lastValue"
    `;
    return `${INVOICE_PREFIX}${String(lastValue).padStart(INVOICE_PAD_LENGTH, '0')}`;
  }

  private async assertOwnedDraft(
    tx: Prisma.TransactionClient,
    id: string,
    userId: string,
  ) {
    const sale = await tx.sale.findUnique({ where: { id } });
    if (!sale) throw new NotFoundException('Bill not found');
    if (sale.status !== SaleStatus.DRAFT) {
      throw new BadRequestException('Bill is no longer a draft');
    }
    if (sale.cashierId !== userId) {
      throw new ForbiddenException('You do not own this held bill');
    }
    return sale;
  }

  async saveDraft(dto: SaveDraftDto, userId: string, existingId?: string) {
    return this.prisma.$transaction(async (tx) => {
      if (existingId) {
        await this.assertOwnedDraft(tx, existingId, userId);
      }

      const computed = await this.computeSale(tx, dto.items);

      if (existingId) {
        await tx.saleItem.deleteMany({ where: { saleId: existingId } });
        return tx.sale.update({
          where: { id: existingId },
          data: {
            subtotal: computed.subtotal,
            discountTotal: computed.discountTotal,
            taxTotal: computed.taxTotal,
            totalAmount: computed.totalAmount,
            items: { create: computed.lines },
          },
          include: SALE_INCLUDE,
        });
      }

      const invoiceNumber = await this.nextInvoiceNumber(tx);
      return tx.sale.create({
        data: {
          invoiceNumber,
          status: SaleStatus.DRAFT,
          cashierId: userId,
          subtotal: computed.subtotal,
          discountTotal: computed.discountTotal,
          taxTotal: computed.taxTotal,
          totalAmount: computed.totalAmount,
          items: { create: computed.lines },
        },
        include: SALE_INCLUDE,
      });
    });
  }

  async listDrafts(userId: string) {
    return this.prisma.sale.findMany({
      where: { status: SaleStatus.DRAFT, cashierId: userId },
      include: SALE_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
  }

  private attachRefundInfo(
    sale: Prisma.SaleGetPayload<{ include: typeof SALE_DETAIL_INCLUDE }>,
  ) {
    const refundedByItem = new Map<string, number>();
    for (const refund of sale.refunds) {
      for (const refundItem of refund.items) {
        refundedByItem.set(
          refundItem.saleItemId,
          (refundedByItem.get(refundItem.saleItemId) ?? 0) +
            toNumber(refundItem.quantity),
        );
      }
    }

    return {
      ...sale,
      refundedAmount: sale.refunds.reduce((sum, r) => sum + r.totalAmount, 0),
      items: sale.items.map((item) => {
        const refundedQuantity = refundedByItem.get(item.id) ?? 0;
        return {
          ...item,
          refundedQuantity,
          refundableQuantity: toNumber(item.quantity) - refundedQuantity,
        };
      }),
    };
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: SALE_DETAIL_INCLUDE,
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (user.role === Role.CASHIER && sale.cashierId !== user.sub) {
      throw new ForbiddenException('You do not own this sale');
    }
    return this.attachRefundInfo(sale);
  }

  async findHistory(query: SalesHistoryQueryDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.SaleWhereInput = {
      status: SaleStatus.COMPLETED,
      // A CASHIER is always scoped to their own sales regardless of any
      // cashierId filter value; only an ADMIN's cashierId filter is honored.
      ...(user.role === Role.CASHIER
        ? { cashierId: user.sub }
        : query.cashierId
          ? { cashierId: query.cashierId }
          : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.productId
        ? { items: { some: { productId: query.productId } } }
        : {}),
      ...(query.invoiceNumber
        ? {
            invoiceNumber: {
              contains: query.invoiceNumber,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(query.from || query.to
        ? {
            completedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: endOfDayExclusive(query.to) } : {}),
            },
          }
        : {}),
    };

    const [sales, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        include: {
          ...SALE_INCLUDE,
          refunds: { select: { totalAmount: true } },
        },
        orderBy: salesHistorySortOrder(query.sortBy, query.sortOrder),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.sale.count({ where }),
    ]);

    const items = sales.map(({ refunds, ...sale }) => ({
      ...sale,
      refundedAmount: refunds.reduce((sum, r) => sum + r.totalAmount, 0),
    }));

    return { items, total, page, pageSize };
  }

  /** Top products by quantity sold — reused by the dashboard widget (small limit) and the sales-by-product report (large/no limit). */
  async getTopProducts(query: {
    from?: string;
    to?: string;
    limit?: number;
    paymentMethod?: PaymentMethod;
    cashierId?: string;
  }) {
    const range = resolveDateRange(query.from, query.to);

    const grouped = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          status: SaleStatus.COMPLETED,
          ...(range.from || range.to
            ? {
                completedAt: {
                  ...(range.from ? { gte: range.from } : {}),
                  ...(range.to ? { lt: range.to } : {}),
                },
              }
            : {}),
          ...saleFilterFields(query),
        },
      },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: 'desc' } },
      ...(query.limit ? { take: query.limit } : {}),
    });

    const products = await this.prisma.product.findMany({
      where: { id: { in: grouped.map((g) => g.productId) } },
      select: { id: true, name: true, sku: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return grouped.map((g) => ({
      productId: g.productId,
      name: productMap.get(g.productId)?.name ?? 'Unknown product',
      sku: productMap.get(g.productId)?.sku ?? '',
      quantitySold: g._sum.quantity ?? 0,
      revenue: g._sum.lineTotal ?? 0,
    }));
  }

  /** Daily sales totals — powers both the trend chart (default: last 30 days) and the daily sales report (explicit range). */
  async getDailySales(query: {
    from?: string;
    to?: string;
    paymentMethod?: PaymentMethod;
    cashierId?: string;
  }) {
    const range =
      query.from || query.to
        ? resolveDateRange(query.from, query.to)
        : lastNDaysRange(30);
    const sales = await this.prisma.sale.findMany({
      where: {
        status: SaleStatus.COMPLETED,
        completedAt: { gte: range.from, lt: range.to },
        ...saleFilterFields(query),
      },
      select: { completedAt: true, totalAmount: true, paymentMethod: true },
    });

    const buckets = new Map<
      string,
      {
        count: number;
        cash: number;
        transfer: number;
        credit: number;
        total: number;
      }
    >();
    for (const sale of sales) {
      const key = sale.completedAt!.toISOString().slice(0, 10);
      const bucket = buckets.get(key) ?? {
        count: 0,
        cash: 0,
        transfer: 0,
        credit: 0,
        total: 0,
      };
      bucket.count += 1;
      bucket.total += sale.totalAmount;
      if (sale.paymentMethod === PaymentMethod.CASH)
        bucket.cash += sale.totalAmount;
      else if (sale.paymentMethod === PaymentMethod.TRANSFER)
        bucket.transfer += sale.totalAmount;
      // SPLIT is grouped with CREDIT here — part of it is still outstanding
      // as khata, so it gets the same revenue-attribution treatment.
      else if (
        sale.paymentMethod === PaymentMethod.CREDIT ||
        sale.paymentMethod === PaymentMethod.SPLIT
      )
        bucket.credit += sale.totalAmount;
      buckets.set(key, bucket);
    }

    return enumerateDays(range.from!, range.to!).map((date) => ({
      date,
      ...(buckets.get(date) ?? {
        count: 0,
        cash: 0,
        transfer: 0,
        credit: 0,
        total: 0,
      }),
    }));
  }

  /** Monthly sales totals — powers both the trend chart (default: last 12 months) and the monthly sales report (explicit range). */
  async getMonthlySales(query: {
    from?: string;
    to?: string;
    paymentMethod?: PaymentMethod;
    cashierId?: string;
  }) {
    const range =
      query.from || query.to
        ? resolveDateRange(query.from, query.to)
        : lastNMonthsRange(12);
    const sales = await this.prisma.sale.findMany({
      where: {
        status: SaleStatus.COMPLETED,
        completedAt: { gte: range.from, lt: range.to },
        ...saleFilterFields(query),
      },
      select: { completedAt: true, totalAmount: true, paymentMethod: true },
    });

    const buckets = new Map<
      string,
      {
        count: number;
        cash: number;
        transfer: number;
        credit: number;
        total: number;
      }
    >();
    for (const sale of sales) {
      const key = sale.completedAt!.toISOString().slice(0, 7);
      const bucket = buckets.get(key) ?? {
        count: 0,
        cash: 0,
        transfer: 0,
        credit: 0,
        total: 0,
      };
      bucket.count += 1;
      bucket.total += sale.totalAmount;
      if (sale.paymentMethod === PaymentMethod.CASH)
        bucket.cash += sale.totalAmount;
      else if (sale.paymentMethod === PaymentMethod.TRANSFER)
        bucket.transfer += sale.totalAmount;
      // SPLIT is grouped with CREDIT here — part of it is still outstanding
      // as khata, so it gets the same revenue-attribution treatment.
      else if (
        sale.paymentMethod === PaymentMethod.CREDIT ||
        sale.paymentMethod === PaymentMethod.SPLIT
      )
        bucket.credit += sale.totalAmount;
      buckets.set(key, bucket);
    }

    return enumerateMonths(range.from!, range.to!).map((month) => ({
      month,
      ...(buckets.get(month) ?? {
        count: 0,
        cash: 0,
        transfer: 0,
        credit: 0,
        total: 0,
      }),
    }));
  }

  async refund(saleId: string, dto: CreateRefundDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { items: { include: { refundItems: true } } },
      });
      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status !== SaleStatus.COMPLETED) {
        throw new BadRequestException('Only completed sales can be refunded');
      }

      const saleItemMap = new Map(sale.items.map((i) => [i.id, i]));
      const alreadyRefundedByItem = new Map<string, number>();

      const refundLines = dto.items.map((requested) => {
        const saleItem = saleItemMap.get(requested.saleItemId);
        if (!saleItem) {
          throw new BadRequestException(
            `Sale item ${requested.saleItemId} does not belong to this sale`,
          );
        }
        const saleItemQuantity = toNumber(saleItem.quantity);
        const alreadyRefunded = saleItem.refundItems.reduce(
          (sum, r) => sum + toNumber(r.quantity),
          0,
        );
        alreadyRefundedByItem.set(saleItem.id, alreadyRefunded);
        const remaining = saleItemQuantity - alreadyRefunded;
        if (requested.quantity > remaining) {
          throw new BadRequestException(
            `Cannot refund ${requested.quantity} of "${saleItem.productName}" — only ${remaining} remaining`,
          );
        }

        const lineDiscount = Math.round(
          (saleItem.lineDiscount * requested.quantity) / saleItemQuantity,
        );
        const lineTax = Math.round(
          (saleItem.lineTax * requested.quantity) / saleItemQuantity,
        );
        const lineSubtotal = Math.round(
          saleItem.unitPrice * requested.quantity,
        );
        const lineTotal = lineSubtotal - lineDiscount + lineTax;

        return {
          saleItemId: saleItem.id,
          productId: saleItem.productId,
          quantity: requested.quantity,
          unitPrice: saleItem.unitPrice,
          lineDiscount,
          lineTax,
          lineTotal,
        };
      });

      const subtotal = refundLines.reduce(
        (sum, l) => sum + Math.round(l.unitPrice * l.quantity),
        0,
      );
      const discountTotal = refundLines.reduce(
        (sum, l) => sum + l.lineDiscount,
        0,
      );
      const taxTotal = refundLines.reduce((sum, l) => sum + l.lineTax, 0);
      const totalAmount = refundLines.reduce((sum, l) => sum + l.lineTotal, 0);

      const refund = await tx.refund.create({
        data: {
          saleId,
          refundedById: userId,
          reason: dto.reason,
          subtotal,
          discountTotal,
          taxTotal,
          totalAmount,
          items: { create: refundLines },
        },
        include: { items: true },
      });

      for (const line of refundLines) {
        await this.inventoryService.restockToBatches(tx, {
          saleItemId: line.saleItemId,
          quantity: line.quantity,
          alreadyRefunded: alreadyRefundedByItem.get(line.saleItemId) ?? 0,
          reason: `Refund of Sale ${sale.invoiceNumber}`,
          userId,
        });
      }

      return refund;
    });
  }

  async deleteDraft(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.assertOwnedDraft(tx, id, userId);
      await tx.sale.delete({ where: { id } });
    });
  }

  /** Resolves the borrower to bill a CREDIT/SPLIT (khata) sale against — an existing one, or a new one created inline. */
  private async resolveBorrower(
    tx: Prisma.TransactionClient,
    dto: CheckoutDto,
  ): Promise<Borrower> {
    if (dto.borrowerId) {
      const borrower = await tx.borrower.findUnique({
        where: { id: dto.borrowerId },
      });
      if (!borrower) {
        throw new BadRequestException('Borrower not found');
      }
      return borrower;
    }

    return tx.borrower.create({
      data: { name: dto.newBorrowerName!, phone: dto.newBorrowerPhone },
    });
  }

  async checkout(dto: CheckoutDto, userId: string, draftId?: string) {
    if (
      dto.paymentMethod === PaymentMethod.CASH &&
      (dto.cashTendered ?? 0) < 0
    ) {
      throw new BadRequestException('Cash tendered cannot be negative');
    }
    const isCreditLike =
      dto.paymentMethod === PaymentMethod.CREDIT ||
      dto.paymentMethod === PaymentMethod.SPLIT;
    // A CASH sale can also need a borrower — not to bill a debt, but to
    // divert its change into that borrower's credit balance instead of
    // handing it back.
    const creditsChangeToBorrower =
      dto.paymentMethod === PaymentMethod.CASH &&
      dto.creditChangeToBorrower === true;
    if (
      (isCreditLike || creditsChangeToBorrower) &&
      !dto.borrowerId &&
      !dto.newBorrowerName
    ) {
      throw new BadRequestException('A borrower is required for this sale');
    }

    return this.prisma.$transaction(async (tx) => {
      if (draftId) {
        await this.assertOwnedDraft(tx, draftId, userId);
      }

      const computed = await this.computeSale(tx, dto.items);

      if (
        dto.paymentMethod === PaymentMethod.CASH &&
        (dto.cashTendered ?? 0) < computed.totalAmount
      ) {
        throw new BadRequestException(
          'Cash tendered is less than the total amount',
        );
      }
      if (
        dto.paymentMethod === PaymentMethod.SPLIT &&
        (dto.cashAmount ?? 0) >= computed.totalAmount
      ) {
        throw new BadRequestException(
          'Cash amount must be less than the total for a split payment',
        );
      }

      let changeDue =
        dto.paymentMethod === PaymentMethod.CASH
          ? (dto.cashTendered ?? 0) - computed.totalAmount
          : null;

      // Beyond the cases that require a borrower (billing khata debt or
      // diverting change to credit), a cashier can still optionally attach
      // an existing or new customer to a fully-paid CASH/TRANSFER sale
      // purely for record-keeping — that's what dto.borrowerId /
      // dto.newBorrowerName being set without either flag means.
      const borrower =
        isCreditLike ||
        creditsChangeToBorrower ||
        dto.borrowerId ||
        dto.newBorrowerName
          ? await this.resolveBorrower(tx, dto)
          : null;

      // CASH/TRANSFER are settled on the spot; a SPLIT sale starts with just
      // its cash portion paid; pure CREDIT starts at 0 — either way, the rest
      // is only ever advanced by KhataService.recordPayment.
      let amountPaid =
        dto.paymentMethod === PaymentMethod.SPLIT
          ? (dto.cashAmount ?? 0)
          : isCreditLike
            ? 0
            : computed.totalAmount;

      // A borrower's leftover store credit (from a past khata overpayment)
      // is applied before any new debt is created — the cashier confirms
      // this with the customer at checkout via dto.useCredit (default true).
      const useCredit = dto.useCredit ?? true;
      if (useCredit && borrower && borrower.creditBalance > 0) {
        const amountDue = computed.totalAmount - amountPaid;
        const creditApplied = Math.min(borrower.creditBalance, amountDue);
        if (creditApplied > 0) {
          amountPaid += creditApplied;
          await tx.borrower.update({
            where: { id: borrower.id },
            data: { creditBalance: { decrement: creditApplied } },
          });
        }
      }

      // A CASH sale's change can be credited to the borrower instead of
      // handed back — the sale itself is still fully paid. If the borrower
      // already has other outstanding khata, the change pays that down
      // first; only what's left over (if any) becomes new store credit.
      if (creditsChangeToBorrower && borrower && changeDue && changeDue > 0) {
        await this.khataService.settleOrCredit(
          tx,
          borrower.id,
          userId,
          changeDue,
          'Cash overpayment credited at checkout',
        );
        changeDue = 0;
      }

      const paymentStatus = !isCreditLike
        ? PaymentStatus.PAID
        : amountPaid >= computed.totalAmount
          ? PaymentStatus.PAID
          : amountPaid > 0
            ? PaymentStatus.PARTIALLY_PAID
            : PaymentStatus.UNPAID;

      const saleData = {
        status: SaleStatus.COMPLETED,
        subtotal: computed.subtotal,
        discountTotal: computed.discountTotal,
        taxTotal: computed.taxTotal,
        totalAmount: computed.totalAmount,
        paymentMethod: dto.paymentMethod,
        cashTendered:
          dto.paymentMethod === PaymentMethod.CASH
            ? (dto.cashTendered ?? null)
            : dto.paymentMethod === PaymentMethod.SPLIT
              ? (dto.cashAmount ?? null)
              : null,
        changeDue,
        transferReference: dto.transferReference ?? null,
        paymentStatus,
        amountPaid,
        borrowerId: borrower?.id ?? null,
        completedAt: new Date(),
      };

      // Sale items are created one at a time (rather than a single nested
      // `create: computed.lines`) so each row's id is known immediately —
      // consumeFefo needs it to record which batch(es) that specific line
      // drew from, for accurate refund restocking later.
      let saleId: string;
      let invoiceNumber: string;
      if (draftId) {
        await tx.saleItem.deleteMany({ where: { saleId: draftId } });
        const updated = await tx.sale.update({
          where: { id: draftId },
          data: saleData,
        });
        saleId = updated.id;
        invoiceNumber = updated.invoiceNumber;
      } else {
        invoiceNumber = await this.nextInvoiceNumber(tx);
        const created = await tx.sale.create({
          data: { invoiceNumber, cashierId: userId, ...saleData },
        });
        saleId = created.id;
      }

      for (const line of computed.lines) {
        const saleItem = await tx.saleItem.create({
          data: { saleId, ...line },
        });
        await this.inventoryService.consumeFefo(tx, {
          productId: line.productId,
          type: StockMovementType.OUT,
          quantity: line.quantity,
          reason: `Sale ${invoiceNumber}`,
          userId,
          saleItemId: saleItem.id,
        });
      }

      return tx.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: SALE_INCLUDE,
      });
    });
  }
}
