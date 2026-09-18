import { Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  currentMonthRange,
  resolveDateRange,
} from '../common/utils/date-range.util';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseQueryDto, ExpenseSortField } from './dto/expense-query.dto';

interface DateRange {
  from?: Date;
  to?: Date;
}

/** Defaults to most-recent-first — every other column stays sortable via sortBy/sortOrder. */
function expenseSortOrder(
  sortBy: ExpenseSortField | undefined,
  sortOrder: 'asc' | 'desc' | undefined,
): Prisma.ExpenseOrderByWithRelationInput {
  const order = sortOrder ?? (sortBy ? 'asc' : 'desc');
  switch (sortBy) {
    case 'category':
      return { category: order };
    case 'amount':
      return { amount: order };
    case 'createdBy':
      return { createdBy: { name: order } };
    case 'date':
    default:
      return { date: order };
  }
}

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateExpenseDto, userId: string) {
    return this.prisma.expense.create({
      data: {
        category: dto.category,
        amount: dto.amount,
        description: dto.description,
        date: new Date(dto.date),
        createdById: userId,
      },
    });
  }

  private buildWhere(
    range: DateRange,
    category?: ExpenseCategory,
  ): Prisma.ExpenseWhereInput {
    return {
      ...(category ? { category } : {}),
      ...(range.from || range.to
        ? {
            date: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lt: range.to } : {}),
            },
          }
        : {}),
    };
  }

  async findAll(query: ExpenseQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(
      resolveDateRange(query.from, query.to),
      query.category,
    );

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: expenseSortOrder(query.sortBy, query.sortOrder),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findOne(id: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async update(id: string, dto: UpdateExpenseDto) {
    await this.findOne(id);
    return this.prisma.expense.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.date ? { date: new Date(dto.date) } : {}),
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.expense.delete({ where: { id } });
  }

  async getSummary(query: Pick<ExpenseQueryDto, 'from' | 'to'>) {
    const range =
      query.from || query.to
        ? resolveDateRange(query.from, query.to)
        : currentMonthRange();
    const where = this.buildWhere(range);

    const byCategory = await this.prisma.expense.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
    });

    const total = byCategory.reduce((sum, c) => sum + (c._sum.amount ?? 0), 0);

    return {
      total,
      byCategory: byCategory.map((c) => ({
        category: c.category,
        total: c._sum.amount ?? 0,
      })),
    };
  }
}
