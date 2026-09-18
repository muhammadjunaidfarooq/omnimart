import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

export const PRODUCT_IMAGES_DIR = join(process.cwd(), 'uploads', 'products');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

if (!existsSync(PRODUCT_IMAGES_DIR)) {
  mkdirSync(PRODUCT_IMAGES_DIR, { recursive: true });
}

export const productImageMulterOptions = {
  storage: diskStorage({
    destination: PRODUCT_IMAGES_DIR,
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
