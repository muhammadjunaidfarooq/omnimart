import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { DayClosingController } from './day-closing.controller';
import { DayClosingService } from './day-closing.service';

@Module({
  imports: [AccountingModule],
  controllers: [DayClosingController],
  providers: [DayClosingService],
  exports: [DayClosingService],
})
export class DayClosingModule {}
