import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import { TripRole, TripStatus } from '../../common/domain/enums.js';
import { DomainException } from '../../common/errors/domain.exception.js';
import { IdempotencyService } from '../../common/idempotency/idempotency.service.js';
import {
  decodeCursor,
  encodeCursor,
} from '../../common/pagination/pagination.dto.js';
import { Campus } from '../catalog/entities/campus.entity.js';
import { Zone } from '../catalog/entities/zone.entity.js';
import type { Student } from '../students/entities/student.entity.js';
import type {
  CreateTripDto,
  TripListQueryDto,
  UpdateTripDto,
} from './dto/trip.dto.js';
import { Trip } from './entities/trip.entity.js';
import { toTripDto } from './trip.presenter.js';
import { TripCapacityPolicy } from './trip-capacity.policy.js';

interface TripCursor extends Record<string, string> {
  createdAt: string;
  id: string;
}

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    @InjectRepository(Zone) private readonly zones: Repository<Zone>,
    @InjectRepository(Campus) private readonly campuses: Repository<Campus>,
    private readonly idempotency: IdempotencyService,
    private readonly dataSource: DataSource,
    private readonly capacityPolicy: TripCapacityPolicy,
  ) {}

  create(student: Student, input: CreateTripDto, key?: string) {
    return this.idempotency.execute(
      student.id,
      'POST:/trips',
      key,
      input,
      async (manager) => {
        await this.validateInput(manager, input);
        const repository = manager.getRepository(Trip);
        const trip = repository.create({
          ...input,
          version: 1,
          studentId: student.id,
          status: TripStatus.ACTIVE,
          departureTime: input.departureTime,
        });
        trip.version = 1;
        try {
          return toTripDto(await repository.save(trip));
        } catch (error) {
          if (this.isUniqueViolation(error)) {
            throw new DomainException(
              'VALIDATION_ERROR',
              'Ya existe un trayecto activo idéntico.',
              HttpStatus.CONFLICT,
            );
          }
          throw error;
        }
      },
    );
  }

  async list(student: Student, query: TripListQueryDto) {
    const cursor = decodeCursor<TripCursor>(query.cursor);
    const builder = this.trips
      .createQueryBuilder('trip')
      .where('trip.student_id = :studentId', { studentId: student.id })
      .andWhere('trip.deleted_at IS NULL')
      .orderBy('trip.created_at', 'DESC')
      .addOrderBy('trip.id', 'DESC')
      .take(query.limit + 1);
    if (query.status)
      builder.andWhere('trip.status = :status', { status: query.status });
    if (cursor) {
      builder.andWhere(
        '(trip.created_at, trip.id) < (:createdAt, :id)',
        cursor,
      );
    }
    const rows = await builder.getMany();
    const hasMore = rows.length > query.limit;
    const selected = rows.slice(0, query.limit);
    const last = selected.at(-1);
    return {
      items: selected.map(toTripDto),
      nextCursor:
        hasMore && last
          ? encodeCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async getOwned(studentId: string, id: string): Promise<Trip> {
    const trip = await this.trips.findOne({
      where: { id, studentId },
      withDeleted: true,
    });
    if (!trip || trip.deletedAt) throw this.notFound();
    return trip;
  }

  async get(student: Student, id: string) {
    return toTripDto(await this.getOwned(student.id, id));
  }

  async update(student: Student, id: string, input: UpdateTripDto) {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Trip);
      const existing = await repository.findOne({
        where: { id, studentId: student.id },
        withDeleted: true,
      });
      if (!existing || existing.deletedAt) throw this.notFound();
      if (existing.version !== input.version) throw this.versionConflict();

      const merged = repository.merge(existing, input);
      await this.validateInput(manager, merged);
      if (
        merged.role === TripRole.DRIVER &&
        typeof merged.seatCapacity === 'number' &&
        merged.seatCapacity < (existing.seatCapacity ?? 0)
      ) {
        const [{ maximum = 0 } = {}] = await manager.query<
          Array<{ maximum: number }>
        >(
          `SELECT COALESCE(MAX(reserved_seats), 0)::int AS maximum
             FROM trip_occurrences WHERE driver_trip_id = $1 AND travel_date >= CURRENT_DATE`,
          [id],
        );
        if (Number(maximum) > merged.seatCapacity) {
          throw new DomainException(
            'TRIP_HAS_ACTIVE_RELATIONS',
            'La capacidad no puede ser menor a las plazas ya reservadas.',
            HttpStatus.CONFLICT,
          );
        }
      }

      const { version: _version, ...changes } = input;
      const result = await repository
        .createQueryBuilder()
        .update(Trip)
        .set({ ...changes, version: () => 'version + 1' })
        .where('id = :id AND student_id = :studentId AND version = :version', {
          id,
          studentId: student.id,
          version: input.version,
        })
        .execute();
      if (result.affected !== 1) throw this.versionConflict();
      return toTripDto((await repository.findOneBy({ id }))!);
    });
  }

  async deactivate(student: Student, id: string) {
    const trip = await this.getOwned(student.id, id);
    trip.status = TripStatus.INACTIVE;
    trip.version += 1;
    return toTripDto(await this.trips.save(trip));
  }

  async delete(student: Student, id: string) {
    const trip = await this.getOwned(student.id, id);
    const relations = await this.dataSource.query<Array<{ count: string }>>(
      `SELECT COUNT(*)::text AS count FROM ride_requests
        WHERE (sender_trip_id = $1 OR target_trip_id = $1)
          AND status IN ('PENDING', 'ACCEPTED')`,
      [id],
    );
    if (Number(relations[0]?.count ?? 0) > 0) {
      throw new DomainException(
        'TRIP_HAS_ACTIVE_RELATIONS',
        'El trayecto tiene solicitudes o coordinaciones activas.',
        HttpStatus.CONFLICT,
      );
    }
    trip.status = TripStatus.DELETED;
    trip.deletedAt = new Date();
    trip.version += 1;
    await this.trips.save(trip);
    return { deleted: true };
  }

  private async validateInput(
    manager: EntityManager,
    input: Pick<
      Trip,
      'originZoneId' | 'destinationCampusId' | 'role' | 'seatCapacity'
    >,
  ) {
    this.capacityPolicy.assertValid(input.role, input.seatCapacity);
    const zone = await manager
      .getRepository(Zone)
      .findOneBy({ id: input.originZoneId, active: true });
    const campus = await manager
      .getRepository(Campus)
      .findOneBy({ id: input.destinationCampusId, active: true });
    if (!zone || !campus) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'La zona o el campus no existen o están inactivos.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private notFound() {
    return new DomainException(
      'TRIP_NOT_FOUND',
      'Trayecto no encontrado.',
      HttpStatus.NOT_FOUND,
    );
  }

  private versionConflict() {
    return new DomainException(
      'TRIP_VERSION_CONFLICT',
      'El trayecto cambió; vuelve a cargarlo.',
      HttpStatus.CONFLICT,
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return Boolean(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === '23505',
    );
  }
}
