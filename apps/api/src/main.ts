import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';
import { DecimalInterceptor } from './common/interceptors/decimal.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Trust exactly one reverse-proxy hop so req.ip (what the rate limiter
  // keys on) reflects the real client IP behind nginx in production —
  // harmless in dev, where there's no proxy and X-Forwarded-For is absent.
  app.set('trust proxy', 1);

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads' });
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new DecimalInterceptor());
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000',
    credentials: true,
  });

  const port = config.get<number>('PORT') ?? 3001;
  await app.listen(port);
}
bootstrap();
