import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
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
  constructor(
    @InjectRepository(Coordination)
    private readonly coordinations: Repository<Coordination>,
    private readonly dataSource: DataSource,
  ) {}

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

  async cancel(id: string, student: Student) {
    return this.dataSource.transaction(async (manager) => {
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
      return this.present(manager, updated, student.id);
    });
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
    };
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
}
