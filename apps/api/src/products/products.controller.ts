import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { BulkCategoryDto } from './dto/bulk-category.dto';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { BulkPriceDto } from './dto/bulk-price.dto';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { productImageMulterOptions } from './product-image.storage';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @Query() query: ProductQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.findAll(query, user.role === Role.CASHIER);
  }

  @Roles(Role.ADMIN)
  @Get('price-list')
  findAllForPriceList() {
    return this.productsService.findAllForPriceList();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Roles(Role.ADMIN)
  @Post()
  create(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.productsService.create(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Roles(Role.ADMIN)
  @Post(':id/duplicate')
  duplicate(@Param('id') id: string) {
    return this.productsService.duplicate(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateProductStatusDto) {
    return this.productsService.updateStatus(id, dto.isActive);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Roles(Role.ADMIN)
  @Post('bulk/category')
  bulkCategory(@Body() dto: BulkCategoryDto) {
    return this.productsService.bulkUpdateCategory(dto);
  }

  @Roles(Role.ADMIN)
  @Post('bulk/status')
  bulkStatus(@Body() dto: BulkStatusDto) {
    return this.productsService.bulkUpdateStatus(dto);
  }

  @Roles(Role.ADMIN)
  @Post('bulk/price')
  bulkPrice(@Body() dto: BulkPriceDto) {
    return this.productsService.bulkUpdatePrice(dto);
  }

  @Roles(Role.ADMIN)
  @Post('bulk/delete')
  bulkDelete(@Body() dto: BulkDeleteDto) {
    return this.productsService.bulkDelete(dto);
  }

  @Roles(Role.ADMIN)
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('image', productImageMulterOptions))
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('An image file is required');
    }
    return this.productsService.setImage(
      id,
      `/uploads/products/${file.filename}`,
    );
  }
}
