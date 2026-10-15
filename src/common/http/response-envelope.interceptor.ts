import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';

export interface PagedResult<T> {
  items: T[];
  nextCursor: string | null;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { requestId?: string }>();
    return next.handle().pipe(
      map((result: unknown) => {
        if (this.isPaged(result)) {
          return {
            data: result.items,
            meta: {
              requestId: request.requestId,
              nextCursor: result.nextCursor,
            },
          };
        }
        return {
          data: result ?? null,
          meta: { requestId: request.requestId, nextCursor: null },
        };
      }),
    );
  }

  private isPaged(value: unknown): value is PagedResult<unknown> {
    return Boolean(
      value &&
      typeof value === 'object' &&
      'items' in value &&
      Array.isArray((value as PagedResult<unknown>).items) &&
      'nextCursor' in value,
    );
  }
}
