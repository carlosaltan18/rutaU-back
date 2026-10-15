import { ValidationPipe, type INestApplication } from '@nestjs/common';
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from '@nestjs/swagger';
import { ApiExceptionFilter } from './common/errors/api-exception.filter.js';
import { requestIdMiddleware } from './common/http/request-id.middleware.js';
import { ResponseEnvelopeInterceptor } from './common/http/response-envelope.interceptor.js';

export function configureApplication(app: INestApplication): OpenAPIObject {
  app.use(requestIdMiddleware);
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  const origins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : false });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('RutaU API')
    .setDescription('API REST v1 para coordinación de trayectos universitarios')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, { jsonDocumentUrl: 'docs-json' });
  return document;
}
