import 'dotenv/config';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';
import { configureApplication } from '../../bootstrap.js';

const app = await NestFactory.create(AppModule, { logger: false });
const document = configureApplication(app);
await app.init();
await writeFile(
  resolve(process.cwd(), 'openapi.json'),
  `${JSON.stringify(document, null, 2)}\n`,
  'utf8',
);
await app.close();
console.log('openapi.json generado.');
