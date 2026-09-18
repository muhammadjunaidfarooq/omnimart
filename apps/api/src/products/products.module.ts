import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { SkuModule } from '../sku/sku.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [SkuModule, InventoryModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
