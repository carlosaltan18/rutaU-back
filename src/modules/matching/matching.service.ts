import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type EntityManager, Repository } from 'typeorm';
import { TripRole, TripStatus } from '../../common/domain/enums.js';
import { DomainException } from '../../common/errors/domain.exception.js';
import {
  decodeCursor,
  encodeCursor,
} from '../../common/pagination/pagination.dto.js';
import {
  isFutureDeparture,
  isoWeekday,
} from '../../common/time/business-time.js';
import { Student } from '../students/entities/student.entity.js';
import { toPublicProfile } from '../students/student.presenter.js';
import type { MatchQueryDto } from '../trips/dto/trip.dto.js';
import { TripOccurrence } from '../trips/entities/trip-occurrence.entity.js';
import { Trip } from '../trips/entities/trip.entity.js';
import { CompatibilityPolicy } from './compatibility.policy.js';

interface MatchCursor extends Record<string, string> {
  difference: string;
  name: string;
  id: string;
}

interface MatchRow {
  candidateTripId: string;
  studentId: string;
  displayName: string;
  photoUrl: string | null;
  universityId: string;
  campusId: string;
  originZoneId: string;
  destinationCampusId: string;
  dayOfWeek: number;
  departureTime: string;
  role: TripRole;
  seatCapacity: number | null;
  availableSeats: number;
  difference: number;
}

@Injectable()
export class MatchingService {
  constructor(
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    @InjectRepository(Student) private readonly students: Repository<Student>,
    private readonly policy: CompatibilityPolicy,
  ) {}

  async findMatches(
    student: Student,
    sourceTripId: string,
    query: MatchQueryDto,
  ) {
    const source = await this.trips.findOneBy({
      id: sourceTripId,
      studentId: student.id,
      status: TripStatus.ACTIVE,
    });
    if (!source) throw this.tripNotFound();
    if (isoWeekday(query.travelDate) !== source.dayOfWeek) {
      throw new DomainException(
        'TRAVEL_DATE_DAY_MISMATCH',
        'La fecha no coincide con el día habitual.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!isFutureDeparture(query.travelDate, source.departureTime)) {
      throw new DomainException(
        'REQUEST_EXPIRED',
        'La fecha y hora de salida ya pasaron.',
        HttpStatus.GONE,
      );
    }

    const cursor = decodeCursor<MatchCursor>(query.cursor);
    const differenceSql =
      'ABS(EXTRACT(EPOCH FROM (candidate.departure_time - source.departure_time)) / 60)';
    const availableSql = `CASE
      WHEN candidate.role = 'DRIVER'
        THEN candidate.seat_capacity - COALESCE(occurrence.reserved_seats, 0)
      ELSE source.seat_capacity - COALESCE(occurrence.reserved_seats, 0)
    END`;
    const builder = this.trips
      .createQueryBuilder('candidate')
      .innerJoin(Trip, 'source', 'source.id = :sourceTripId', { sourceTripId })
      .innerJoin(Student, 'student', 'student.id = candidate.student_id')
      .leftJoin(
        TripOccurrence,
        'occurrence',
        `occurrence.driver_trip_id = CASE WHEN candidate.role = 'DRIVER'
          THEN candidate.id ELSE source.id END AND occurrence.travel_date = :travelDate`,
        { travelDate: query.travelDate },
      )
      .select('candidate.id', 'candidateTripId')
      .addSelect('student.id', 'studentId')
      .addSelect('student.display_name', 'displayName')
      .addSelect('student.photo_url', 'photoUrl')
      .addSelect('student.university_id', 'universityId')
      .addSelect('student.campus_id', 'campusId')
      .addSelect('candidate.origin_zone_id', 'originZoneId')
      .addSelect('candidate.destination_campus_id', 'destinationCampusId')
      .addSelect('candidate.day_of_week', 'dayOfWeek')
      .addSelect('candidate.departure_time', 'departureTime')
      .addSelect('candidate.role', 'role')
      .addSelect('candidate.seat_capacity', 'seatCapacity')
      .addSelect(availableSql, 'availableSeats')
      .addSelect(differenceSql, 'difference')
      .where('candidate.status = :active', { active: TripStatus.ACTIVE })
      .andWhere('candidate.deleted_at IS NULL')
      .andWhere('candidate.student_id <> :studentId', { studentId: student.id })
      .andWhere('candidate.origin_zone_id = source.origin_zone_id')
      .andWhere(
        'candidate.destination_campus_id = source.destination_campus_id',
      )
      .andWhere('candidate.day_of_week = source.day_of_week')
      .andWhere('candidate.role <> source.role')
      .andWhere(`${differenceSql} <= 30`)
      .andWhere('occurrence.live_started_at IS NULL')
      .andWhere(`${availableSql} > 0`)
      .orderBy(differenceSql, 'ASC')
      .addOrderBy('student.display_name', 'ASC')
      .addOrderBy('candidate.id', 'ASC')
      .limit(query.limit + 1);
    if (cursor) {
      builder.andWhere(
        `(${differenceSql}, student.display_name, candidate.id) > (:difference, :name, :id)`,
        cursor,
      );
    }

    const rows = await builder.getRawMany<MatchRow>();
    const hasMore = rows.length > query.limit;
    const selected = rows.slice(0, query.limit);
    const items = selected.map((row) => ({
      candidateTripId: row.candidateTripId,
      profile: {
        id: row.studentId,
        displayName: row.displayName,
        photoUrl: row.photoUrl,
        universityId: row.universityId,
        campusId: row.campusId,
      },
      role: row.role,
      originZoneId: row.originZoneId,
      destinationCampusId: row.destinationCampusId,
      dayOfWeek: Number(row.dayOfWeek),
      departureTime: row.departureTime.slice(0, 5),
      timeDifferenceMinutes: Number(row.difference),
      reasons: this.policy.evaluate(
        source,
        {
          id: row.candidateTripId,
          studentId: row.studentId,
          originZoneId: row.originZoneId,
          destinationCampusId: row.destinationCampusId,
          dayOfWeek: Number(row.dayOfWeek),
          departureTime: row.departureTime,
          role: row.role,
        },
        Number(row.availableSeats),
      ).reasons,
      availableSeats: Number(row.availableSeats),
      canRequest: true,
    }));
    const lastRow = selected.at(-1);
    return {
      items,
      nextCursor:
        hasMore && lastRow
          ? encodeCursor({
              difference: String(lastRow.difference),
              name: lastRow.displayName,
              id: lastRow.candidateTripId,
            })
          : null,
    };
  }

  async getAuthorizedCandidate(
    student: Student,
    sourceTripId: string,
    candidateTripId: string,
  ) {
    const [source, candidate] = await Promise.all([
      this.trips.findOneBy({
        id: sourceTripId,
        studentId: student.id,
        status: TripStatus.ACTIVE,
      }),
      this.trips.findOneBy({ id: candidateTripId, status: TripStatus.ACTIVE }),
    ]);
    if (!source || !candidate) throw this.tripNotFound();
    const capacity =
      candidate.role === TripRole.DRIVER
        ? (candidate.seatCapacity ?? 0)
        : (source.seatCapacity ?? 0);
    const compatibility = this.policy.evaluate(source, candidate, capacity);
    if (!compatibility.compatible) throw this.tripNotFound();
    const candidateStudent = await this.students.findOneBy({
      id: candidate.studentId,
    });
    if (!candidateStudent) throw this.tripNotFound();
    return {
      candidateTripId,
      profile: toPublicProfile(candidateStudent),
      trip: {
        originZoneId: candidate.originZoneId,
        destinationCampusId: candidate.destinationCampusId,
        dayOfWeek: candidate.dayOfWeek,
        departureTime: candidate.departureTime.slice(0, 5),
        role: candidate.role,
      },
      timeDifferenceMinutes: compatibility.timeDifferenceMinutes,
      reasons: compatibility.reasons,
    };
  }

  async assertCompatible(
    manager: EntityManager,
    source: Trip,
    target: Trip,
    travelDate: string,
  ) {
    if (
      source.status !== TripStatus.ACTIVE ||
      target.status !== TripStatus.ACTIVE ||
      source.deletedAt ||
      target.deletedAt
    ) {
      throw this.noLongerCompatible();
    }
    const driver = source.role === TripRole.DRIVER ? source : target;
    if (
      isoWeekday(travelDate) !== source.dayOfWeek ||
      isoWeekday(travelDate) !== target.dayOfWeek
    ) {
      throw new DomainException(
        'TRAVEL_DATE_DAY_MISMATCH',
        'La fecha no coincide con el día habitual.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
    if (!isFutureDeparture(travelDate, driver.departureTime)) {
      throw new DomainException(
        'REQUEST_EXPIRED',
        'La fecha y hora de salida ya pasaron.',
        HttpStatus.GONE,
      );
    }
    const occurrence = await manager.getRepository(TripOccurrence).findOneBy({
      driverTripId: driver.id,
      travelDate,
    });
    if (occurrence?.liveStartedAt) {
      throw this.liveTripAlreadyStarted();
    }
    const availableSeats =
      (occurrence?.seatCapacitySnapshot ?? driver.seatCapacity ?? 0) -
      (occurrence?.reservedSeats ?? 0);
    const result = this.policy.evaluate(source, target, availableSeats);
    if (!result.compatible) {
      if (availableSeats <= 0) {
        throw new DomainException(
          'NO_SEATS_AVAILABLE',
          'No quedan plazas para esa fecha.',
          HttpStatus.CONFLICT,
        );
      }
      throw this.noLongerCompatible();
    }
    return { driver, availableSeats, result };
  }

  private tripNotFound() {
    return new DomainException(
      'TRIP_NOT_FOUND',
      'Trayecto no encontrado.',
      HttpStatus.NOT_FOUND,
    );
  }

  private noLongerCompatible() {
    return new DomainException(
      'NO_LONGER_COMPATIBLE',
      'Los trayectos ya no son compatibles.',
      HttpStatus.CONFLICT,
    );
  }

  private liveTripAlreadyStarted() {
    return new DomainException(
      'LIVE_TRIP_ALREADY_STARTED',
      'El viaje ya inició y no acepta nuevas solicitudes.',
      HttpStatus.CONFLICT,
    );
  }
}
