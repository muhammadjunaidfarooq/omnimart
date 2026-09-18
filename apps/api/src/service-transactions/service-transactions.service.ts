import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethod, Prisma, Role, ServiceDirection } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveDateRange } from '../common/utils/date-range.util';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { CreateServiceTransactionDto } from './dto/create-service-transaction.dto';
import {
  ServiceTransactionQueryDto,
  ServiceTransactionSortField,
} from './dto/service-transaction-query.dto';

const TRANSACTION_PREFIX = 'SVC-';
const TRANSACTION_PAD_LENGTH = 6;

/** Cents per Rs 1,000 — the slab size for a tiered-fee service's charge. */
const THOUSAND_CENTS = 100_000;

/**
 * A tiered-fee service's charge: feePerThousand for every Rs 1,000 of
 * billAmount, rounding UP to the next slab — e.g. at a rate of 20, a bill of
 * Rs 1,000 charges 20 and Rs 1,500 charges 40 (rounds up to the Rs 2,000
 * slab), same as Rs 5,000 charging 100.
 */
function computeTieredFee(
  billAmountCents: number,
  feePerThousandCents: number,
): number {
  if (billAmountCents <= 0) return 0;
  const slabs = Math.ceil(billAmountCents / THOUSAND_CENTS);
  return slabs * feePerThousandCents;
}

const SERVICE_TRANSACTION_INCLUDE = {
  service: { select: { id: true, name: true } },
  cashier: { select: { id: true, name: true } },
} satisfies Prisma.ServiceTransactionInclude;

/** Defaults to most-recent-first — every other column stays sortable via sortBy/sortOrder. */
function serviceTransactionSortOrder(
  sortBy: ServiceTransactionSortField | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): Prisma.ServiceTransactionOrderByWithRelationInput {
  const order = sortOrder ?? (sortBy ? 'asc' : 'desc');
  switch (sortBy) {
    case 'transactionNumber':
      return { transactionNumber: order };
    case 'service':
      return { service: { name: order } };
    case 'cashier':
      return { cashier: { name: order } };
    case 'totalAmount':
      return { totalAmount: order };
    case 'createdAt':
    default:
      return { createdAt: order };
  }
}

@Injectable()
export class ServiceTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ServiceTransactionQueryDto, user: AuthenticatedUser) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const range = resolveDateRange(query.from, query.to);

    const where: Prisma.ServiceTransactionWhereInput = {
      ...(query.serviceId ? { serviceId: query.serviceId } : {}),
      // A CASHIER is always scoped to their own transactions regardless of
      // any cashierId filter value; only an ADMIN's cashierId filter is honored.
      ...(user.role === Role.CASHIER
        ? { cashierId: user.sub }
        : query.cashierId
          ? { cashierId: query.cashierId }
          : {}),
      ...(range.from || range.to
        ? { createdAt: { gte: range.from, lt: range.to } }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.serviceTransaction.findMany({
        where,
        include: SERVICE_TRANSACTION_INCLUDE,
        orderBy: serviceTransactionSortOrder(query.sortBy, query.sortOrder),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.serviceTransaction.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  private async nextTransactionNumber(
    tx: Prisma.TransactionClient,
  ): Promise<string> {
    const [{ lastValue }] = await tx.$queryRaw<{ lastValue: number }[]>`
      UPDATE "service_transaction_counters" SET "lastValue" = "lastValue" + 1 WHERE id = 1 RETURNING "lastValue"
    `;
    return `${TRANSACTION_PREFIX}${String(lastValue).padStart(TRANSACTION_PAD_LENGTH, '0')}`;
  }

  async create(dto: CreateServiceTransactionDto, cashierId: string) {
    return this.prisma.$transaction(async (tx) => {
      const service = await tx.service.findUnique({
        where: { id: dto.serviceId },
      });
      if (!service) throw new NotFoundException('Service not found');
      if (!service.isActive) {
        throw new BadRequestException('This service is no longer active');
      }

      const transactionNumber = await this.nextTransactionNumber(tx);
      const data =
        service.direction === ServiceDirection.BILL_PAYMENT
          ? this.buildBillPaymentData(dto, service)
          : this.buildCashFlowData(dto, service);

      return tx.serviceTransaction.create({
        data: {
          transactionNumber,
          serviceId: dto.serviceId,
          cashierId,
          // Snapshotted so a later change to Service.direction never
          // reclassifies this transaction's cash-flow retroactively.
          direction: service.direction,
          referenceNumber: dto.referenceNumber,
          note: dto.note,
          ...data,
        },
        include: SERVICE_TRANSACTION_INCLUDE,
      });
    });
  }

  /** The customer pays the shop (CASH/TRANSFER); serviceFee is store revenue, billAmount passes through. */
  private buildBillPaymentData(
    dto: CreateServiceTransactionDto,
    service: { useTieredFee: boolean; feePerThousand: number | null },
  ) {
    // Recalculated server-side — never trust a client-submitted total, same
    // rule as Sale. A tiered-fee service ignores dto.serviceFee entirely
    // and derives it from the bill amount instead — see computeTieredFee.
    const serviceFee = service.useTieredFee
      ? computeTieredFee(dto.billAmount, service.feePerThousand ?? 0)
      : (dto.serviceFee ?? 0);
    const totalAmount = dto.billAmount + serviceFee;
    if (totalAmount <= 0) {
      throw new BadRequestException(
        'The total amount must be greater than zero',
      );
    }

    const paymentMethod = dto.paymentMethod ?? PaymentMethod.CASH;
    let amountReceived: number;
    let changeDue: number;
    let transferReference: string | null = null;

    // No khata/credit path for services (unlike Sale) — TRANSFER is always
    // paid in full with no change, mirroring the cashier POS's checkout
    // flow, which likewise skips "amount received" for a transfer.
    if (paymentMethod === PaymentMethod.TRANSFER) {
      if (!dto.transferReference?.trim()) {
        throw new BadRequestException('A transfer reference is required');
      }
      transferReference = dto.transferReference;
      amountReceived = totalAmount;
      changeDue = 0;
    } else {
      if (dto.amountReceived == null) {
        throw new BadRequestException('Amount received is required');
      }
      if (dto.amountReceived < totalAmount) {
        throw new BadRequestException(
          'Amount received is less than the total due',
        );
      }
      amountReceived = dto.amountReceived;
      changeDue = amountReceived - totalAmount;
    }

    return {
      billAmount: dto.billAmount,
      serviceFee,
      totalAmount,
      paymentMethod,
      transferReference,
      amountReceived,
      changeDue,
    };
  }

  /**
   * CASH_WITHDRAWAL: the shop hands the customer physical cash, funded by a
   * bank transfer they already made. CASH_DEPOSIT: the customer hands the
   * shop physical cash, and the shop transfers the same amount out on their
   * behalf. Both may charge a fee (same Service.defaultFee/useTieredFee/
   * feePerThousand config as a BILL_PAYMENT service).
   *
   * Every transaction here has two sides — money in (a transfer for a
   * withdrawal, cash for a deposit) and money out (cash for a withdrawal, a
   * transfer for a deposit) — with fee = amountIn - amountOut. dto.billAmount
   * is whichever side the cashier confirmed as fixed via dto.feeInclusive:
   *   - true ("fee included"): billAmount IS the money-in side; the fee
   *     comes out of it to produce the money-out side (e.g. a withdrawal
   *     funded by a 1,000 transfer pays out 980 cash with a 20 fee).
   *   - false ("fee excluded", default): billAmount IS the money-out side;
   *     the fee is added on top to produce the money-in side (e.g. a
   *     withdrawal paying out 1,000 cash needs a 1,020 transfer to fund it).
   * This is symmetric across both directions — see the
   * ServiceTransaction.feeInclusive doc comment for all four cases.
   * `totalAmount` is always the side that actually hits the cash drawer —
   * amountOut for a withdrawal, amountIn for a deposit — so
   * AccountingService.getDailyCashSummary needs no feeInclusive-specific
   * math. paymentMethod is recorded (TRANSFER for a withdrawal, CASH for a
   * deposit) but AccountingService always keys off the snapshotted
   * `direction`, not this field, to decide the actual cash-flow direction.
   */
  private buildCashFlowData(
    dto: CreateServiceTransactionDto,
    service: {
      direction: ServiceDirection;
      useTieredFee: boolean;
      feePerThousand: number | null;
    },
  ) {
    if (dto.billAmount <= 0) {
      throw new BadRequestException('Enter an amount greater than zero');
    }
    if (!dto.transferReference?.trim()) {
      throw new BadRequestException('A transfer reference is required');
    }

    const serviceFee = service.useTieredFee
      ? computeTieredFee(dto.billAmount, service.feePerThousand ?? 0)
      : (dto.serviceFee ?? 0);

    const feeInclusive = dto.feeInclusive ?? false;
    const amountIn = feeInclusive
      ? dto.billAmount
      : dto.billAmount + serviceFee;
    const amountOut = feeInclusive
      ? dto.billAmount - serviceFee
      : dto.billAmount;
    if (amountOut <= 0) {
      throw new BadRequestException(
        'The fee cannot be greater than or equal to the amount',
      );
    }

    const isWithdrawal = service.direction === ServiceDirection.CASH_WITHDRAWAL;
    const totalAmount = isWithdrawal ? amountOut : amountIn;

    return {
      billAmount: dto.billAmount,
      serviceFee,
      feeInclusive,
      totalAmount,
      paymentMethod: isWithdrawal ? PaymentMethod.TRANSFER : PaymentMethod.CASH,
      transferReference: dto.transferReference,
      amountReceived: totalAmount,
      changeDue: 0,
    };
  }
}
