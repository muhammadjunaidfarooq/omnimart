import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { DayClosingService } from './day-closing.service';
import { CloseDayDto } from './dto/close-day.dto';
import { DayClosingQueryDto } from './dto/day-closing-query.dto';
import { DayClosingPreviewQueryDto } from './dto/day-closing-preview-query.dto';

@Roles(Role.ADMIN)
@Controller('day-closing')
export class DayClosingController {
  constructor(private readonly dayClosingService: DayClosingService) {}

  @Get()
  findAll(@Query() query: DayClosingQueryDto) {
    return this.dayClosingService.findAll(query);
  }

  @Get('preview')
  getPreview(@Query() query: DayClosingPreviewQueryDto) {
    return this.dayClosingService.getPreview(query.date);
  }

  @Post()
  closeDay(@Body() dto: CloseDayDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dayClosingService.closeDay(dto, user.sub);
  }
}
