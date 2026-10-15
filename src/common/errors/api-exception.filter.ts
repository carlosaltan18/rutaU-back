import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  HttpException,
  HttpStatus,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainException } from './domain.exception.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
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
    } else {
      // El detalle se registra sin cuerpo ni credenciales sensibles.
      console.error('Unhandled request error', {
        requestId: request.requestId,
        method: request.method,
        path: request.path,
        error: exception instanceof Error ? exception.name : 'UnknownError',
      });
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
