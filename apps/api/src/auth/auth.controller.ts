import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { parseDurationMs } from '../common/utils/duration.util';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import type { AuthenticatedUser } from './types/authenticated-user';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  // Stricter than the app-wide default — closes off unlimited password
  // guessing against this specific endpoint.
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateCredentials(
      dto.email,
      dto.password,
    );
    const tokens = await this.authService.issueTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: AuthenticatedUser & { refreshToken: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.refreshTokens(
      user.sub,
      user.refreshToken,
    );
    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);
    return { success: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.sub);
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.cookieOptions(0));
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.cookieOptions(0));
    return { success: true };
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const dbUser = await this.usersService.findById(user.sub);
    if (!dbUser) {
      throw new NotFoundException('User not found');
    }
    return {
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return { success: true };
  }

  /**
   * `maxAge` matters here: without it, both cookies default to browser-session
   * cookies that vanish the moment the tab/browser closes, forcing a re-login
   * regardless of how long the token itself remains valid. Setting it to the
   * token's own lifetime keeps the two in sync, so the session actually lasts
   * as long as JWT_ACCESS_EXPIRES_IN/JWT_REFRESH_EXPIRES_IN say it should.
   */
  private cookieOptions(maxAgeMs: number) {
    const isProduction = this.config.get('NODE_ENV') === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: maxAgeMs,
    };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ) {
    const accessMaxAge = parseDurationMs(
      this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
    );
    const refreshMaxAge = parseDurationMs(
      this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
    );
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      accessToken,
      this.cookieOptions(accessMaxAge),
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      refreshToken,
      this.cookieOptions(refreshMaxAge),
    );
  }
}
