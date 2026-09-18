import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Injectable()
export class UnitsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.unit.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateUnitDto) {
    try {
      return await this.prisma.unit.create({ data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A unit with this name already exists');
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateUnitDto) {
    try {
      return await this.prisma.unit.update({ where: { id }, data: dto });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A unit with this name already exists');
      }
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.unit.delete({ where: { id } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          'Cannot delete a unit that has products assigned to it',
        );
      }
      throw error;
    }
  }
}
