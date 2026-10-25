import { HttpStatus, Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type EntityManager, Repository } from 'typeorm';
import {
  CoordinationStatus,
  NotificationType,
  RequestStatus,
  RequestType,
  TripRole,
} from '../../common/domain/enums.js';
import { DomainException } from '../../common/errors/domain.exception.js';
import { IdempotencyService } from '../../common/idempotency/idempotency.service.js';
import {
  decodeCursor,
  encodeCursor,
} from '../../common/pagination/pagination.dto.js';
import { Coordination } from '../coordinations/entities/coordination.entity.js';
import { MatchingService } from '../matching/matching.service.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { Student } from '../students/entities/student.entity.js';
import {
  toAuthorizedContact,
  toPublicProfile,
} from '../students/student.presenter.js';
import { TripOccurrence } from '../trips/entities/trip-occurrence.entity.js';
import { Trip } from '../trips/entities/trip.entity.js';
import type {
  CreateRideRequestDto,
  RideRequestListQueryDto,
} from './dto/ride-request.dto.js';
import { RideRequest } from './entities/ride-request.entity.js';
import { RequestStatePolicy } from './request-state.policy.js';

interface RequestCursor extends Record<string, string> {
  createdAt: string;
  id: string;
}

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(RideRequest)
    private readonly requests: Repository<RideRequest>,
    private readonly dataSource: DataSource,
    private readonly idempotency: IdempotencyService,
    private readonly matching: MatchingService,
    private readonly statePolicy: RequestStatePolicy,
  ) {}

  create(student: Student, input: CreateRideRequestDto, key?: string) {
    return this.idempotency.execute(
      student.id,
      'POST:/ride-requests',
      key,
      input,
      async (manager) => {
        const { sender, target } = await this.loadPair(
          manager,
          input.senderTripId,
          input.targetTripId,
        );
        if (
          sender.studentId !== student.id ||
          target.studentId === student.id
        ) {
          throw new DomainException(
            'FORBIDDEN',
            'No puedes crear esta solicitud.',
            HttpStatus.FORBIDDEN,
          );
        }
        this.assertTypeRoles(input.type, sender, target);
        await this.matching.assertCompatible(
          manager,
          sender,
          target,
          input.travelDate,
        );

        const driver = sender.role === TripRole.DRIVER ? sender : target;
        const passenger = sender.role === TripRole.PASSENGER ? sender : target;
        const pairKey = [sender.id, target.id].sort().join(':');
        const repository = manager.getRepository(RideRequest);
        try {
          const request = await repository.save(
            repository.create({
              type: input.type,
              senderTripId: sender.id,
              targetTripId: target.id,
              driverTripId: driver.id,
              passengerTripId: passenger.id,
              travelDate: input.travelDate,
              requestedSeats: 1,
              offeredContributionMinor: String(input.offeredContributionMinor),
              currency: 'GTQ',
              message: input.message || null,
              status: RequestStatus.PENDING,
              pairKey,
            }),
          );
          await this.notify(
            manager,
            target.studentId,
            NotificationType.REQUEST_RECEIVED,
            request.id,
          );
          return this.detailWithManager(manager, request, student.id);
        } catch (error) {
          if (this.isUniqueViolation(error)) {
            throw new DomainException(
              'REQUEST_ALREADY_EXISTS',
              'Ya existe una solicitud activa para estos trayectos y fecha.',
              HttpStatus.CONFLICT,
            );
          }
          throw error;
        }
      },
    );
  }

  async list(student: Student, query: RideRequestListQueryDto) {
    const cursor = decodeCursor<RequestCursor>(query.cursor);
    const builder = this.requests
      .createQueryBuilder('request')
      .innerJoin(Trip, 'sender', 'sender.id = request.sender_trip_id')
      .innerJoin(Trip, 'target', 'target.id = request.target_trip_id')
      .where(
        query.box === 'sent'
          ? 'sender.student_id = :studentId'
          : 'target.student_id = :studentId',
        { studentId: student.id },
      )
      .orderBy('request.created_at', 'DESC')
      .addOrderBy('request.id', 'DESC')
      .take(query.limit + 1);
    if (query.status)
      builder.andWhere('request.status = :status', { status: query.status });
    if (cursor) {
      builder.andWhere(
        '(request.created_at, request.id) < (:createdAt, :id)',
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
    return this.dataSource.transaction(async (manager) => {
      const request = await this.findVisible(manager, id, student.id);
      return this.detailWithManager(manager, request, student.id);
    });
  }

  async accept(id: string, student: Student) {
    return this.dataSource.transaction(async (manager) => {
      const request = await this.lockRequest(manager, id);
      const { sender, target } = await this.loadPair(
        manager,
        request.senderTripId,
        request.targetTripId,
        true,
      );
      if (target.studentId !== student.id) throw this.requestNotFound();
      this.statePolicy.assertTransition(
        request.status,
        RequestStatus.ACCEPTED,
        'RECEIVER',
      );
      const { driver } = await this.matching.assertCompatible(
        manager,
        sender,
        target,
        request.travelDate,
      );

      await manager
        .createQueryBuilder()
        .insert()
        .into(TripOccurrence)
        .values({
          driverTripId: driver.id,
          travelDate: request.travelDate,
          seatCapacitySnapshot: driver.seatCapacity!,
          reservedSeats: 0,
        })
        .orIgnore()
        .execute();
      const occurrence = await manager.getRepository(TripOccurrence).findOne({
        where: { driverTripId: driver.id, travelDate: request.travelDate },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !occurrence ||
        occurrence.reservedSeats >= occurrence.seatCapacitySnapshot
      ) {
        throw new DomainException(
          'NO_SEATS_AVAILABLE',
          'No quedan plazas para esa fecha.',
          HttpStatus.CONFLICT,
        );
      }
      if (occurrence.liveStartedAt) {
        throw new DomainException(
          'LIVE_TRIP_ALREADY_STARTED',
          'El viaje ya inició y no acepta nuevos pasajeros.',
          HttpStatus.CONFLICT,
        );
      }

      request.status = RequestStatus.ACCEPTED;
      request.respondedAt = new Date();
      occurrence.reservedSeats += 1;
      await manager.getRepository(RideRequest).save(request);
      await manager.getRepository(TripOccurrence).save(occurrence);

      const driverStudentId = driver.studentId;
      const passenger = sender.role === TripRole.PASSENGER ? sender : target;
      await manager.getRepository(Coordination).save(
        manager.getRepository(Coordination).create({
          rideRequestId: request.id,
          driverStudentId,
          passengerStudentId: passenger.studentId,
          driverTripId: driver.id,
          passengerTripId: passenger.id,
          travelDate: request.travelDate,
          plannedDepartureTime: driver.departureTime,
          originZoneId: driver.originZoneId,
          destinationCampusId: driver.destinationCampusId,
          agreedContributionMinor: request.offeredContributionMinor,
          currency: 'GTQ',
          status: CoordinationStatus.CONFIRMED,
        }),
      );
      await this.notify(
        manager,
        sender.studentId,
        NotificationType.REQUEST_ACCEPTED,
        request.id,
      );
      return this.detailWithManager(manager, request, student.id);
    });
  }

  async reject(id: string, student: Student) {
    return this.respondToPending(
      id,
      student,
      RequestStatus.REJECTED,
      NotificationType.REQUEST_REJECTED,
    );
  }

  async cancelPending(id: string, student: Student) {
    return this.dataSource.transaction(async (manager) => {
      const request = await this.lockRequest(manager, id);
      const { sender, target } = await this.loadPair(
        manager,
        request.senderTripId,
        request.targetTripId,
        true,
      );
      if (sender.studentId !== student.id) throw this.requestNotFound();
      this.statePolicy.assertTransition(
        request.status,
        RequestStatus.CANCELLED,
        'SENDER',
      );
      request.status = RequestStatus.CANCELLED;
      request.cancelledAt = new Date();
      await manager.getRepository(RideRequest).save(request);
      await this.notify(
        manager,
        target.studentId,
        NotificationType.REQUEST_CANCELLED,
        request.id,
      );
      return this.detailWithManager(manager, request, student.id);
    });
  }

  @Cron('0 * * * * *', {
    name: 'expire-ride-requests',
    timeZone: 'America/Guatemala',
  })
  async expirePastRequests() {
    const expired = await this.dataSource.query<Array<{ id: string }>>(`
      SELECT request.id
        FROM ride_requests request
        JOIN trips driver ON driver.id = request.driver_trip_id
       WHERE request.status = 'PENDING'
         AND (request.travel_date + driver.departure_time)
             AT TIME ZONE 'America/Guatemala' <= now()
       LIMIT 200
    `);
    for (const row of expired) {
      await this.dataSource.transaction(async (manager) => {
        const request = await manager.getRepository(RideRequest).findOne({
          where: { id: row.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!request || request.status !== RequestStatus.PENDING) return;
        request.status = RequestStatus.EXPIRED;
        request.expiredAt = new Date();
        await manager.getRepository(RideRequest).save(request);
        const sender = await manager.getRepository(Trip).findOneByOrFail({
          id: request.senderTripId,
        });
        await this.notify(
          manager,
          sender.studentId,
          NotificationType.REQUEST_EXPIRED,
          request.id,
        );
      });
    }
  }

  private async respondToPending(
    id: string,
    student: Student,
    status: RequestStatus.REJECTED,
    notification: NotificationType,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const request = await this.lockRequest(manager, id);
      const { sender, target } = await this.loadPair(
        manager,
        request.senderTripId,
        request.targetTripId,
        true,
      );
      if (target.studentId !== student.id) throw this.requestNotFound();
      this.statePolicy.assertTransition(request.status, status, 'RECEIVER');
      request.status = status;
      request.respondedAt = new Date();
      await manager.getRepository(RideRequest).save(request);
      await this.notify(manager, sender.studentId, notification, request.id);
      return this.detailWithManager(manager, request, student.id);
    });
  }

  private async findVisible(
    manager: EntityManager,
    id: string,
    studentId: string,
  ) {
    const request = await manager.getRepository(RideRequest).findOneBy({ id });
    if (!request) throw this.requestNotFound();
    const { sender, target } = await this.loadPair(
      manager,
      request.senderTripId,
      request.targetTripId,
      true,
    );
    if (sender.studentId !== studentId && target.studentId !== studentId) {
      throw this.requestNotFound();
    }
    return request;
  }

  private async detailWithManager(
    manager: EntityManager,
    request: RideRequest,
    actorStudentId: string,
  ) {
    const { sender, target } = await this.loadPair(
      manager,
      request.senderTripId,
      request.targetTripId,
      true,
    );
    if (
      sender.studentId !== actorStudentId &&
      target.studentId !== actorStudentId
    ) {
      throw this.requestNotFound();
    }
    const senderStudent = await manager
      .getRepository(Student)
      .findOneByOrFail({ id: sender.studentId });
    const targetStudent = await manager
      .getRepository(Student)
      .findOneByOrFail({ id: target.studentId });
    const coordination = await manager
      .getRepository(Coordination)
      .findOneBy({ rideRequestId: request.id });
    const occurrence = await manager.getRepository(TripOccurrence).findOneBy({
      driverTripId: request.driverTripId,
      travelDate: request.travelDate,
    });
    const difference = Math.abs(
      Number(sender.departureTime.slice(0, 2)) * 60 +
        Number(sender.departureTime.slice(3, 5)) -
        (Number(target.departureTime.slice(0, 2)) * 60 +
          Number(target.departureTime.slice(3, 5))),
    );
    const driver = sender.role === TripRole.DRIVER ? sender : target;
    const showContact =
      request.status === RequestStatus.ACCEPTED &&
      coordination?.status === CoordinationStatus.CONFIRMED;
    const counterpart =
      sender.studentId === actorStudentId ? targetStudent : senderStudent;
    return {
      id: request.id,
      type: request.type,
      status: request.status,
      travelDate: request.travelDate,
      message: request.message,
      offeredContributionMinor: Number(request.offeredContributionMinor),
      currency: request.currency,
      senderTrip: this.tripSummary(sender),
      targetTrip: this.tripSummary(target),
      sender: toPublicProfile(senderStudent),
      target: toPublicProfile(targetStudent),
      timeDifferenceMinutes: difference,
      availableSeats:
        (occurrence?.seatCapacitySnapshot ?? driver.seatCapacity ?? 0) -
        (occurrence?.reservedSeats ?? 0),
      coordination:
        coordination && request.status === RequestStatus.ACCEPTED
          ? {
              id: coordination.id,
              status: coordination.status,
              plannedDepartureTime: coordination.plannedDepartureTime.slice(
                0,
                5,
              ),
            }
          : null,
      contact: showContact ? toAuthorizedContact(counterpart) : null,
      createdAt: request.createdAt,
      respondedAt: request.respondedAt,
    };
  }

  private tripSummary(trip: Trip) {
    return {
      id: trip.id,
      originZoneId: trip.originZoneId,
      destinationCampusId: trip.destinationCampusId,
      dayOfWeek: trip.dayOfWeek,
      departureTime: trip.departureTime.slice(0, 5),
      role: trip.role,
    };
  }

  private async lockRequest(manager: EntityManager, id: string) {
    const request = await manager.getRepository(RideRequest).findOne({
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!request) throw this.requestNotFound();
    return request;
  }

  private async loadPair(
    manager: EntityManager,
    senderId: string,
    targetId: string,
    withDeleted = false,
  ) {
    const repository = manager.getRepository(Trip);
    const sender = await repository.findOne({
      where: { id: senderId },
      withDeleted,
    });
    const target = await repository.findOne({
      where: { id: targetId },
      withDeleted,
    });
    if (!sender || !target) {
      throw new DomainException(
        'TRIP_NOT_FOUND',
        'Trayecto no encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }
    return { sender, target };
  }

  private assertTypeRoles(type: RequestType, sender: Trip, target: Trip) {
    const valid =
      (type === RequestType.JOIN_REQUEST &&
        sender.role === TripRole.PASSENGER &&
        target.role === TripRole.DRIVER) ||
      (type === RequestType.DRIVER_INVITATION &&
        sender.role === TripRole.DRIVER &&
        target.role === TripRole.PASSENGER);
    if (!valid) {
      throw new DomainException(
        'NO_LONGER_COMPATIBLE',
        'El tipo de solicitud no corresponde a los roles.',
        HttpStatus.CONFLICT,
      );
    }
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

  private requestNotFound() {
    return new DomainException(
      'REQUEST_NOT_FOUND',
      'Solicitud no encontrada.',
      HttpStatus.NOT_FOUND,
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
