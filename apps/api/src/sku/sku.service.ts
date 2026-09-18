import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

const SKU_PREFIX = 'PRD-';
const SKU_PAD_LENGTH = 6;

@Injectable()
export class SkuService {
  /**
   * Atomically increments the singleton counter row and returns the next SKU.
   * Must be called inside the same transaction as the entity creation so a
   * rolled-back create also rolls back the increment (keeps SKUs gapless).
   */
  async nextSku(tx: Prisma.TransactionClient): Promise<string> {
    const [{ lastValue }] = await tx.$queryRaw<{ lastValue: number }[]>`
      UPDATE "sku_counters" SET "lastValue" = "lastValue" + 1 WHERE id = 1 RETURNING "lastValue"
    `;
    return `${SKU_PREFIX}${String(lastValue).padStart(SKU_PAD_LENGTH, '0')}`;
  }
}
