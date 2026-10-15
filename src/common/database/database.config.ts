import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DATABASE_ENTITIES } from './database.entities.js';

export function databaseOptions(): TypeOrmModuleOptions {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }

  const isRender = url.includes('.render.com');
  return {
    type: 'postgres',
    url,
    entities: DATABASE_ENTITIES,
    migrations: ['dist/common/database/migrations/*.js'],
    migrationsRun: false,
    synchronize: false,
    ssl: isRender ? { rejectUnauthorized: false } : false,
    extra: {
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 30_000,
      keepAlive: true,
    },
    logging:
      process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  };
}
