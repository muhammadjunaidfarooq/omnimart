import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

// initialStock is intentionally excluded — stock is only ever mutated via
// the inventory ledger (Phase 3 adjustment endpoints), never through an edit form.
export class UpdateProductDto extends PartialType(
  OmitType(CreateProductDto, ['initialStock'] as const),
) {}
