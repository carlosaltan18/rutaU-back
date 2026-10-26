import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainException } from './domain.exception.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { requestId?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Ocurrió un error interno.';
    let fieldErrors: Array<{ field: string; message: string }> = [];

    if (exception instanceof DomainException) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      fieldErrors = exception.fieldErrors;
    } else if (exception instanceof BadRequestException) {
      status = exception.getStatus();
      code = 'VALIDATION_ERROR';
      message = 'Los datos enviados no son válidos.';
      const body = exception.getResponse();
      const messages =
        typeof body === 'object' && body && 'message' in body
          ? (body as { message?: unknown }).message
          : undefined;
      fieldErrors = (Array.isArray(messages) ? messages : [messages])
        .filter((item): item is string => typeof item === 'string')
        .map((item) => ({ field: item.split(' ')[0] ?? '', message: item }));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code =
        status === HttpStatus.TOO_MANY_REQUESTS ? 'RATE_LIMITED' : 'FORBIDDEN';
      message = exception.message;
    }

    if (status >= 500) {
      this.logger.error(
        `[${request.requestId?.slice(0, 8) ?? 'req'}] ${request.method} ${request.originalUrl ?? request.path} -> ${status} [${code}]: ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      const fieldsInfo = fieldErrors.length
        ? ` | Fields: ${JSON.stringify(fieldErrors)}`
        : '';
      this.logger.warn(
        `[${request.requestId?.slice(0, 8) ?? 'req'}] ${request.method} ${request.originalUrl ?? request.path} -> ${status} [${code}]: ${message}${fieldsInfo}`,
      );
    }

    response.status(status).json({
      error: {
        code,
        message,
        fieldErrors,
        requestId: request.requestId,
      },
    });
  }
}
