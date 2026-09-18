import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

const SETTINGS_ID = 1;

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getSettings() {
    return this.prisma.businessSettings.findUniqueOrThrow({
      where: { id: SETTINGS_ID },
    });
  }

  update(dto: UpdateSettingsDto) {
    return this.prisma.businessSettings.update({
      where: { id: SETTINGS_ID },
      data: dto,
    });
  }

  setLogo(logoUrl: string) {
    return this.prisma.businessSettings.update({
      where: { id: SETTINGS_ID },
      data: { logoUrl },
    });
  }
}
