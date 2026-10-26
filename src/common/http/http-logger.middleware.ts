import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

export function httpLoggerMiddleware(
  request: Request & { requestId?: string },
  response: Response,
  next: NextFunction,
) {
  const start = Date.now();
  const { method, originalUrl, ip } = request;

  response.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = response;
    const reqId = request.requestId ? `[${request.requestId.slice(0, 8)}] ` : '';
    const message = `${reqId}${method} ${originalUrl} ${statusCode} - ${duration}ms (IP: ${ip})`;

    if (statusCode >= 500) {
      logger.error(message);
    } else if (statusCode >= 400) {
      logger.warn(message);
    } else {
      logger.log(message);
    }
  });

  next();
}
