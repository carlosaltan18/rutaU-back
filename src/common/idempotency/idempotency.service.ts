import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { DomainException } from '../errors/domain.exception.js';
import { IdempotencyKey } from './idempotency-key.entity.js';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly dataSource: DataSource) {}

  async execute<T extends Record<string, unknown>>(
    studentId: string,
    endpoint: string,
    key: string | undefined,
    payload: unknown,
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    if (!key) return this.dataSource.transaction(operation);
    if (key.length < 8 || key.length > 200) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Idempotency-Key debe tener entre 8 y 200 caracteres.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const payloadHash = createHash('sha256')
      .update(canonicalJson(payload))
      .digest('hex');
    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `${studentId}:${endpoint}:${key}`,
      ]);
      const repository = manager.getRepository(IdempotencyKey);
      const existing = await repository.findOneBy({ studentId, endpoint, key });
      if (existing) {
        if (existing.payloadHash !== payloadHash) {
          throw new DomainException(
            'IDEMPOTENCY_KEY_REUSED',
            'La llave de idempotencia ya fue usada con otra carga.',
            HttpStatus.CONFLICT,
          );
        }
        return existing.responseBody as T;
      }

      const result = await operation(manager);
      await repository.save(
        repository.create({
          studentId,
          endpoint,
          key,
          payloadHash,
          responseStatus: 201,
          responseBody: result,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }),
      );
      return result;
    });
  }
}
