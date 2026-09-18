import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Patch('me')
  updateOwnProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Roles(Role.ADMIN)
  @Post()
  async createUser(@Body() dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.usersService.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
    });
  }

  @Roles(Role.ADMIN)
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    if (id === currentUser.sub) {
      throw new BadRequestException(
        'You cannot change your own account status',
      );
    }
    return this.usersService.updateStatus(id, dto.isActive);
  }

  @Roles(Role.ADMIN)
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
  ) {
    if (id === currentUser.sub) {
      throw new BadRequestException(
        'Use your profile settings to change your own password',
      );
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePasswordHash(id, passwordHash);
    return { success: true };
  }
}
