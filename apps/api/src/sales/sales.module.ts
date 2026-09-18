import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { KhataModule } from '../khata/khata.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [InventoryModule, KhataModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
