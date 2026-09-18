import { Module } from '@nestjs/common';
import { ServiceTransactionsController } from './service-transactions.controller';
import { ServiceTransactionsService } from './service-transactions.service';

@Module({
  controllers: [ServiceTransactionsController],
  providers: [ServiceTransactionsService],
  exports: [ServiceTransactionsService],
})
export class ServiceTransactionsModule {}
