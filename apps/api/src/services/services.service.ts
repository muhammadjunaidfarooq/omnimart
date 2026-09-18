import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.service.findMany({ orderBy: { name: 'asc' } });
  }

  /** Active services only — powers the cashier POS's service picker. */
  findActive() {
    return this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  private validateFeeConfig(
    useTieredFee: boolean,
    feePerThousand: number | null | undefined,
  ) {
    if (useTieredFee && feePerThousand == null) {
      throw new BadRequestException(
        'A fee per Rs 1,000 is required when tiered fee is enabled',
      );
    }
  }

  async create(dto: CreateServiceDto) {
    this.validateFeeConfig(dto.useTieredFee ?? false, dto.feePerThousand);
    try {
      return await this.prisma.service.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A service with this name already exists');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateServiceDto) {
    const existing = await this.prisma.service.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Service not found');
    this.validateFeeConfig(
      dto.useTieredFee ?? existing.useTieredFee,
      dto.feePerThousand ?? existing.feePerThousand,
    );

    try {
      return await this.prisma.service.update({ where: { id }, data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A service with this name already exists');
      }
      throw error;
    }
  }

  updateStatus(id: string, isActive: boolean) {
    return this.prisma.service.update({ where: { id }, data: { isActive } });
  }

  /**
   * Hard-deletes a service. One with any recorded transactions can't be
   * removed (FK constraint) — deactivating it via updateStatus is the right
   * move there, so that transaction history stays intact.
   */
  async remove(id: string) {
    try {
      await this.prisma.service.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Service not found');
        }
        if (error.code === 'P2003') {
          throw new ConflictException(
            'Cannot delete a service with transaction history — deactivate it instead',
          );
        }
      }
      throw error;
    }
  }
}
