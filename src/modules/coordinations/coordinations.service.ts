import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, In, Repository } from 'typeorm';
import {
  CoordinationStatus,
  NotificationType,
  RequestStatus,
} from '../../common/domain/enums.js';
import { DomainException } from '../../common/errors/domain.exception.js';
import {
  decodeCursor,
  encodeCursor,
} from '../../common/pagination/pagination.dto.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { LiveLocationService } from '../live-location/live-location.service.js';
import { RideRequest } from '../requests/entities/ride-request.entity.js';
import { Student } from '../students/entities/student.entity.js';
import {
  toAuthorizedContact,
  toPublicProfile,
} from '../students/student.presenter.js';
import { TripOccurrence } from '../trips/entities/trip-occurrence.entity.js';
import type { CoordinationQueryDto } from './dto/coordination-query.dto.js';
import { Coordination } from './entities/coordination.entity.js';

interface CoordinationCursor extends Record<string, string> {
  createdAt: string;
  id: string;
}

@Injectable()
export class CoordinationsService {
  private readonly logger = new Logger(CoordinationsService.name);
  private readonly liveLocationMaxHours: number;

  constructor(
    @InjectRepository(Coordination)
    private readonly coordinations: Repository<Coordination>,
    private readonly dataSource: DataSource,
    private readonly liveLocation: LiveLocationService,
    config: ConfigService,
  ) {
    this.liveLocationMaxHours = config.get<number>(
      'LIVE_LOCATION_MAX_HOURS',
      12,
    );
  }

  async list(student: Student, query: CoordinationQueryDto) {
    const cursor = decodeCursor<CoordinationCursor>(query.cursor);
    const builder = this.coordinations
      .createQueryBuilder('coordination')
      .where(
        '(coordination.driver_student_id = :studentId OR coordination.passenger_student_id = :studentId)',
        { studentId: student.id },
      )
      .orderBy('coordination.created_at', 'DESC')
      .addOrderBy('coordination.id', 'DESC')
      .take(query.limit + 1);
    if (query.status) {
      builder.andWhere('coordination.status = :status', {
        status: query.status,
      });
    }
    if (cursor) {
      builder.andWhere(
        '(coordination.created_at, coordination.id) < (:createdAt, :id)',
        cursor,
      );
    }
    const rows = await builder.getMany();
    const hasMore = rows.length > query.limit;
    const selected = rows.slice(0, query.limit);
    const items = await Promise.all(
      selected.map((row) => this.detail(row.id, student)),
    );
    const last = selected.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async detail(id: string, student: Student) {
    const coordination = await this.coordinations.findOneBy({ id });
    if (!coordination || !this.isParticipant(coordination, student.id)) {
      throw this.notFound();
    }
    return this.present(this.dataSource.manager, coordination, student.id);
  }

  async byRequest(requestId: string, student: Student) {
    const coordination = await this.coordinations.findOneBy({
      rideRequestId: requestId,
    });
    if (!coordination || !this.isParticipant(coordination, student.id)) {
      throw this.notFound();
    }
    return this.present(this.dataSource.manager, coordination, student.id);
  }

  async startLiveLocation(id: string, student: Student) {
    await this.dataSource.transaction(async (manager) => {
      const coordination = await this.lockDriverCoordination(
        manager,
        id,
        student,
      );
      if (coordination.status !== CoordinationStatus.CONFIRMED) {
        throw this.liveTripNotActive(
          'La coordinación ya no permite iniciar el viaje.',
        );
      }
      const occurrence = await this.lockOccurrence(manager, coordination);
      if (occurrence.liveEndedAt) {
        throw this.liveTripNotActive('El viaje ya finalizó.');
      }
      if (!occurrence.liveStartedAt) {
        occurrence.liveStartedAt = new Date();
        await manager.getRepository(TripOccurrence).save(occurrence);
      }
      const run = await manager
        .getRepository(Coordination)
        .createQueryBuilder('coordination')
        .setLock('pessimistic_write')
        .where('coordination.driver_trip_id = :driverTripId', {
          driverTripId: coordination.driverTripId,
        })
        .andWhere('coordination.travel_date = :travelDate', {
          travelDate: coordination.travelDate,
        })
        .andWhere('coordination.status = :status', {
          status: CoordinationStatus.CONFIRMED,
        })
        .getMany();
      const studentIds = [
        coordination.driverStudentId,
        ...run.map((item) => item.passengerStudentId),
      ];
      const students = await manager
        .getRepository(Student)
        .findBy({ id: In(studentIds) });
      const authSubjectById = new Map(
        students.map((item) => [item.id, item.authSubject]),
      );
      const driverUid = authSubjectById.get(coordination.driverStudentId);
      if (!driverUid) {
        throw new Error('Driver auth subject was not found');
      }
      const passengerUids = run.map((item) => {
        const uid = authSubjectById.get(item.passengerStudentId);
        if (!uid) throw new Error('Passenger auth subject was not found');
        return uid;
      });
      const expiresAt = new Date(
        occurrence.liveStartedAt.getTime() +
          this.liveLocationMaxHours * 60 * 60 * 1000,
      );
      await this.liveLocation.activateOccurrence({
        driverTripId: coordination.driverTripId,
        travelDate: coordination.travelDate,
        driverUid,
        passengerUids,
        startedAt: occurrence.liveStartedAt,
        expiresAt,
      });
    });
    return this.detail(id, student);
  }

  async endLiveLocation(id: string, student: Student) {
    const prepared = await this.dataSource.transaction(async (manager) => {
      const coordination = await this.lockDriverCoordination(
        manager,
        id,
        student,
      );
      const occurrence = await this.lockOccurrence(manager, coordination);
      if (!occurrence.liveStartedAt) {
        throw this.liveTripNotActive('El viaje todavía no ha iniciado.');
      }
      return coordination;
    });

    await this.liveLocation.closeOccurrence(
      prepared.driverTripId,
      prepared.travelDate,
    );

    await this.dataSource.transaction(async (manager) => {
      const occurrence = await this.lockOccurrence(manager, prepared);
      if (!occurrence.liveEndedAt) {
        const endedAt = new Date();
        occurrence.liveEndedAt = endedAt;
        await manager.getRepository(TripOccurrence).save(occurrence);
        await manager.getRepository(Coordination).update(
          {
            driverTripId: prepared.driverTripId,
            travelDate: prepared.travelDate,
            status: CoordinationStatus.CONFIRMED,
          },
          { status: CoordinationStatus.COMPLETED, completedAt: endedAt },
        );
      }
    });
    return this.detail(id, student);
  }

  @Cron('0 */15 * * * *', { name: 'close-stale-live-trips' })
  async closeStaleLiveTrips(): Promise<void> {
    const cutoff = new Date(
      Date.now() - this.liveLocationMaxHours * 60 * 60 * 1000,
    );
    const occurrences = await this.dataSource
      .getRepository(TripOccurrence)
      .createQueryBuilder('occurrence')
      .where('occurrence.live_started_at IS NOT NULL')
      .andWhere('occurrence.live_ended_at IS NULL')
      .andWhere('occurrence.live_started_at <= :cutoff', { cutoff })
      .orderBy('occurrence.live_started_at', 'ASC')
      .take(100)
      .getMany();
    for (const occurrence of occurrences) {
      try {
        await this.liveLocation.closeOccurrence(
          occurrence.driverTripId,
          occurrence.travelDate,
        );
        await this.completeLiveRun(
          occurrence.driverTripId,
          occurrence.travelDate,
        );
      } catch {
        this.logger.warn(
          `Could not close stale live trip ${occurrence.driverTripId}_${occurrence.travelDate}`,
        );
      }
    }
  }

  async cancel(id: string, student: Student) {
    const outcome = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Coordination);
      const coordination = await repository.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!coordination || !this.isParticipant(coordination, student.id)) {
        throw this.notFound();
      }
      if (coordination.status !== CoordinationStatus.CONFIRMED) {
        throw new DomainException(
          'REQUEST_NOT_PENDING',
          'La coordinación ya no puede cancelarse.',
          HttpStatus.CONFLICT,
        );
      }
      if (coordination.driverStudentId === student.id) {
        await this.cancelDriverRun(manager, coordination);
      } else {
        await this.cancelPassenger(manager, coordination);
      }
      const updated = await repository.findOneByOrFail({ id });
      return {
        data: await this.present(manager, updated, student.id),
        driverCancelled: coordination.driverStudentId === student.id,
        driverTripId: coordination.driverTripId,
        travelDate: coordination.travelDate,
      };
    });
    try {
      if (outcome.driverCancelled) {
        await this.liveLocation.closeOccurrence(
          outcome.driverTripId,
          outcome.travelDate,
        );
      } else {
        await this.liveLocation.removeParticipant(
          outcome.driverTripId,
          outcome.travelDate,
          student.authSubject,
        );
      }
    } catch {
      this.logger.warn(
        `Could not clean live location after cancelling coordination ${id}`,
      );
    }
    return outcome.data;
  }

  private async cancelPassenger(
    manager: EntityManager,
    coordination: Coordination,
  ) {
    const now = new Date();
    coordination.status = CoordinationStatus.CANCELLED;
    coordination.cancelledAt = now;
    await manager.getRepository(Coordination).save(coordination);
    await manager
      .getRepository(RideRequest)
      .update(
        { id: coordination.rideRequestId },
        { status: RequestStatus.CANCELLED, cancelledAt: now },
      );
    const occurrence = await manager.getRepository(TripOccurrence).findOne({
      where: {
        driverTripId: coordination.driverTripId,
        travelDate: coordination.travelDate,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (occurrence) {
      occurrence.reservedSeats = Math.max(0, occurrence.reservedSeats - 1);
      await manager.getRepository(TripOccurrence).save(occurrence);
    }
    await this.notify(
      manager,
      coordination.driverStudentId,
      NotificationType.COORDINATION_CANCELLED,
      coordination.id,
    );
  }

  private async cancelDriverRun(
    manager: EntityManager,
    selected: Coordination,
  ) {
    const repository = manager.getRepository(Coordination);
    const run = await repository
      .createQueryBuilder('coordination')
      .setLock('pessimistic_write')
      .where('coordination.driver_trip_id = :driverTripId', {
        driverTripId: selected.driverTripId,
      })
      .andWhere('coordination.travel_date = :travelDate', {
        travelDate: selected.travelDate,
      })
      .andWhere('coordination.status = :status', {
        status: CoordinationStatus.CONFIRMED,
      })
      .getMany();
    const now = new Date();
    for (const coordination of run) {
      coordination.status = CoordinationStatus.CANCELLED;
      coordination.cancelledAt = now;
      await manager
        .getRepository(RideRequest)
        .update(
          { id: coordination.rideRequestId },
          { status: RequestStatus.CANCELLED, cancelledAt: now },
        );
      await this.notify(
        manager,
        coordination.passengerStudentId,
        NotificationType.COORDINATION_CANCELLED,
        coordination.id,
      );
    }
    await repository.save(run);
    const occurrence = await manager.getRepository(TripOccurrence).findOne({
      where: {
        driverTripId: selected.driverTripId,
        travelDate: selected.travelDate,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (occurrence) {
      occurrence.reservedSeats = 0;
      if (occurrence.liveStartedAt && !occurrence.liveEndedAt) {
        occurrence.liveEndedAt = now;
      }
      await manager.getRepository(TripOccurrence).save(occurrence);
    }
  }

  private async present(
    manager: EntityManager,
    coordination: Coordination,
    actorStudentId: string,
  ) {
    const driver = await manager
      .getRepository(Student)
      .findOneByOrFail({ id: coordination.driverStudentId });
    const passenger = await manager
      .getRepository(Student)
      .findOneByOrFail({ id: coordination.passengerStudentId });
    const occurrence = await manager.getRepository(TripOccurrence).findOneBy({
      driverTripId: coordination.driverTripId,
      travelDate: coordination.travelDate,
    });
    const confirmed = coordination.status === CoordinationStatus.CONFIRMED;
    const counterpart = actorStudentId === driver.id ? passenger : driver;
    return {
      id: coordination.id,
      rideRequestId: coordination.rideRequestId,
      status: coordination.status,
      travelDate: coordination.travelDate,
      plannedDepartureTime: coordination.plannedDepartureTime.slice(0, 5),
      originZoneId: coordination.originZoneId,
      destinationCampusId: coordination.destinationCampusId,
      agreedContributionMinor: Number(coordination.agreedContributionMinor),
      currency: coordination.currency,
      driver: toPublicProfile(driver),
      passenger: toPublicProfile(passenger),
      contact: confirmed ? toAuthorizedContact(counterpart) : null,
      createdAt: coordination.createdAt,
      cancelledAt: coordination.cancelledAt,
      completedAt: coordination.completedAt,
      liveLocation: {
        occurrenceId: this.liveLocation.occurrenceId(
          coordination.driverTripId,
          coordination.travelDate,
        ),
        status:
          confirmed && occurrence?.liveStartedAt && !occurrence.liveEndedAt
            ? 'ACTIVE'
            : confirmed && !occurrence?.liveStartedAt
              ? 'NOT_STARTED'
              : 'ENDED',
        startedAt: occurrence?.liveStartedAt ?? null,
        endedAt: occurrence?.liveEndedAt ?? null,
        canStart:
          coordination.driverStudentId === actorStudentId &&
          confirmed &&
          !occurrence?.liveStartedAt,
        canEnd:
          coordination.driverStudentId === actorStudentId &&
          confirmed &&
          Boolean(occurrence?.liveStartedAt) &&
          !occurrence?.liveEndedAt,
      },
    };
  }

  private async lockDriverCoordination(
    manager: EntityManager,
    id: string,
    student: Student,
  ) {
    const coordination = await manager.getRepository(Coordination).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!coordination || !this.isParticipant(coordination, student.id)) {
      throw this.notFound();
    }
    if (coordination.driverStudentId !== student.id) {
      throw new DomainException(
        'FORBIDDEN',
        'Solo el conductor puede controlar la ubicación en vivo.',
        HttpStatus.FORBIDDEN,
      );
    }
    return coordination;
  }

  private async lockOccurrence(
    manager: EntityManager,
    coordination: Pick<Coordination, 'driverTripId' | 'travelDate'>,
  ) {
    const occurrence = await manager.getRepository(TripOccurrence).findOne({
      where: {
        driverTripId: coordination.driverTripId,
        travelDate: coordination.travelDate,
      },
      lock: { mode: 'pessimistic_write' },
    });
    if (!occurrence) {
      throw this.liveTripNotActive(
        'No existe una ocurrencia confirmada para el viaje.',
      );
    }
    return occurrence;
  }

  private completeLiveRun(driverTripId: string, travelDate: string) {
    return this.dataSource.transaction(async (manager) => {
      const occurrence = await manager.getRepository(TripOccurrence).findOne({
        where: { driverTripId, travelDate },
        lock: { mode: 'pessimistic_write' },
      });
      if (!occurrence || occurrence.liveEndedAt) return;
      const endedAt = new Date();
      occurrence.liveEndedAt = endedAt;
      await manager.getRepository(TripOccurrence).save(occurrence);
      await manager.getRepository(Coordination).update(
        {
          driverTripId,
          travelDate,
          status: CoordinationStatus.CONFIRMED,
        },
        { status: CoordinationStatus.COMPLETED, completedAt: endedAt },
      );
    });
  }

  private isParticipant(coordination: Coordination, studentId: string) {
    return (
      coordination.driverStudentId === studentId ||
      coordination.passengerStudentId === studentId
    );
  }

  private notify(
    manager: EntityManager,
    studentId: string,
    type: NotificationType,
    resourceId: string,
  ) {
    const repository = manager.getRepository(Notification);
    return repository.save(
      repository.create({ studentId, type, resourceId, payload: {} }),
    );
  }

  private notFound() {
    return new DomainException(
      'COORDINATION_NOT_FOUND',
      'Coordinación no encontrada.',
      HttpStatus.NOT_FOUND,
    );
  }

  private liveTripNotActive(message: string) {
    return new DomainException(
      'LIVE_TRIP_NOT_ACTIVE',
      message,
      HttpStatus.CONFLICT,
    );
  }
}
