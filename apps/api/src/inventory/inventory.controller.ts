import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { InventoryService } from './inventory.service';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { StockInDto } from './dto/stock-in.dto';
import { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import { ExpiryQueryDto } from './dto/expiry-query.dto';
import { UpdateStockBatchDto } from './dto/update-stock-batch.dto';
import { BulkMinimumStockDto } from './dto/bulk-minimum-stock.dto';
import { BulkStockInDto } from './dto/bulk-stock-in.dto';
import { BulkAdjustDto } from './dto/bulk-adjust.dto';

@Roles(Role.ADMIN)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(@Query() query: InventoryQueryDto) {
    return this.inventoryService.findAll(query);
  }

  @Get('summary')
  getSummary() {
    return this.inventoryService.getSummary();
  }

  // Cashiers need this view too, so it overrides the controller's ADMIN-only default.
  @Roles(Role.ADMIN, Role.CASHIER)
  @Get('expiry')
  getExpiryOverview(@Query() query: ExpiryQueryDto) {
    return this.inventoryService.getExpiryOverview(query);
  }

  // Declared before the :productId/* routes below — a literal "bulk" segment
  // would otherwise be swallowed by :productId (e.g. bulk/stock-in matching
  // :productId/stock-in with productId="bulk") since Nest/Express tries
  // routes in declaration order.
  @Post('bulk/minimum-stock')
  bulkMinimumStock(@Body() dto: BulkMinimumStockDto) {
    return this.inventoryService.bulkSetMinimumStock(dto);
  }

  @Post('bulk/stock-in')
  bulkStockIn(
    @Body() dto: BulkStockInDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.bulkStockIn(dto, user.sub);
  }

  @Post('bulk/adjust')
  bulkAdjust(
    @Body() dto: BulkAdjustDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.bulkAdjust(dto, user.sub);
  }

  @Get(':productId/movements')
  getMovements(@Param('productId') productId: string) {
    return this.inventoryService.getMovements(productId);
  }

  @Get(':productId/batches')
  getBatches(@Param('productId') productId: string) {
    return this.inventoryService.getBatches(productId);
  }

  @Post(':productId/stock-in')
  stockIn(
    @Param('productId') productId: string,
    @Body() dto: StockInDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.stockIn(
      productId,
      dto.quantity,
      dto.reason,
      user.sub,
      dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      dto.costPrice,
      dto.sellingPrice,
    );
  }

  @Post(':productId/adjust')
  adjust(
    @Param('productId') productId: string,
    @Body() dto: StockAdjustmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.adjust(
      productId,
      dto.quantity,
      dto.reason,
      user.sub,
      dto.expiryDate ? new Date(dto.expiryDate) : undefined,
      dto.costPrice,
      dto.sellingPrice,
    );
  }

  @Patch(':productId/batches/:batchId')
  updateBatch(
    @Param('productId') productId: string,
    @Param('batchId') batchId: string,
    @Body() dto: UpdateStockBatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventoryService.updateBatch(productId, batchId, dto, user.sub);
  }
}
