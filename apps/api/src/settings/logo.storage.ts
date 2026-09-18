import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

export const LOGO_DIR = join(process.cwd(), 'uploads', 'settings');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

if (!existsSync(LOGO_DIR)) {
  mkdirSync(LOGO_DIR, { recursive: true });
}

export const logoMulterOptions = {
  storage: diskStorage({
    destination: LOGO_DIR,
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new BadRequestException('Only JPEG, PNG, or WebP images are allowed'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
