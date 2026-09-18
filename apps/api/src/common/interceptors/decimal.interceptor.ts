import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Prisma serializes Decimal fields to strings via Decimal.prototype.toJSON()
 * (e.g. SaleItem.quantity would become the string "0.250" instead of the
 * number 0.25), which would silently break the frontend's numeric types.
 * This recursively converts any Prisma.Decimal instance in a response
 * payload to a plain number before it is sent over the wire.
 */
@Injectable()
export class DecimalInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((data) => toPlainValue(data)));
  }
}

function toPlainValue(value: unknown): unknown {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(toPlainValue);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [key, toPlainValue(val)]),
    );
  }
  return value;
}
