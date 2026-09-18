import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { logoMulterOptions } from './logo.storage';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get()
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Roles(Role.ADMIN)
  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.update(dto);
  }

  @Roles(Role.ADMIN)
  @Post('logo')
  @UseInterceptors(FileInterceptor('logo', logoMulterOptions))
  uploadLogo(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('A logo image file is required');
    }
    return this.settingsService.setLogo(`/uploads/settings/${file.filename}`);
  }
}
