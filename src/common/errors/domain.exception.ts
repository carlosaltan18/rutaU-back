import { HttpException, type HttpStatus } from '@nestjs/common';
import type { ApiErrorCode } from './api-error-code.js';

export class DomainException extends HttpException {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    status: HttpStatus,
    public readonly fieldErrors: Array<{ field: string; message: string }> = [],
  ) {
    super(message, status);
  }
}
