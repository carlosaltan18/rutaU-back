import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AccountStatus } from '../../common/domain/enums.js';
import { DomainException } from '../../common/errors/domain.exception.js';
import { Campus } from '../catalog/entities/campus.entity.js';
import type { UpdateMeDto } from './dto/update-me.dto.js';
import { Student } from './entities/student.entity.js';
import { toPrivateProfile } from './student.presenter.js';

@Injectable()
export class StudentsService {
  constructor(
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(Campus) private readonly campuses: Repository<Campus>,
    private readonly dataSource: DataSource,
  ) {}

  getMe(student: Student) {
    return toPrivateProfile(student);
  }

  async updateMe(student: Student, input: UpdateMeDto) {
    if (input.universityId && !input.campusId) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Selecciona también un campus para la universidad elegida.',
        HttpStatus.BAD_REQUEST,
        [
          {
            field: 'campusId',
            message: 'El campus es obligatorio al cambiar de universidad.',
          },
        ],
      );
    }
    if (input.campusId) {
      const campus = await this.campuses.findOneBy({
        id: input.campusId,
        universityId: input.universityId ?? student.universityId,
        active: true,
      });
      if (!campus) {
        throw new DomainException(
          'VALIDATION_ERROR',
          'El campus no pertenece a la universidad del estudiante.',
          HttpStatus.BAD_REQUEST,
          [
            {
              field: 'campusId',
              message: 'Campus inválido para la universidad.',
            },
          ],
        );
      }
    }
    Object.assign(student, input);
    return toPrivateProfile(await this.students.save(student));
  }

  async deleteMe(student: Student) {
    await this.dataSource.transaction(async (manager) => {
      const locked = await manager.getRepository(Student).findOne({
        where: { id: student.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.deletedAt) return;

      const now = new Date();
      const passengerCoordinations = await manager.query<
        Array<{
          id: string;
          ride_request_id: string;
          driver_trip_id: string;
          travel_date: string;
        }>
      >(
        `SELECT id, ride_request_id, driver_trip_id, travel_date
           FROM coordinations
          WHERE passenger_student_id = $1 AND status = 'CONFIRMED'
          FOR UPDATE`,
        [student.id],
      );
      for (const coordination of passengerCoordinations) {
        await manager.query(
          `UPDATE trip_occurrences SET reserved_seats = GREATEST(0, reserved_seats - 1), updated_at = now()
            WHERE driver_trip_id = $1 AND travel_date = $2`,
          [coordination.driver_trip_id, coordination.travel_date],
        );
        await manager.query(
          `UPDATE coordinations SET status = 'CANCELLED', cancelled_at = $2 WHERE id = $1`,
          [coordination.id, now],
        );
        await manager.query(
          `UPDATE ride_requests SET status = 'CANCELLED', cancelled_at = $2 WHERE id = $1`,
          [coordination.ride_request_id, now],
        );
      }

      const lockedDriverCoordinations = await manager.query<
        Array<{ driver_trip_id: string; travel_date: string }>
      >(
        `SELECT driver_trip_id, travel_date
           FROM coordinations
          WHERE driver_student_id = $1 AND status = 'CONFIRMED'
          FOR UPDATE`,
        [student.id],
      );
      const driverRuns = [
        ...new Map(
          lockedDriverCoordinations.map((run) => [
            `${run.driver_trip_id}:${run.travel_date}`,
            run,
          ]),
        ).values(),
      ];
      for (const run of driverRuns) {
        await manager.query(
          `UPDATE coordinations SET status = 'CANCELLED', cancelled_at = $3
            WHERE driver_trip_id = $1 AND travel_date = $2 AND status = 'CONFIRMED'`,
          [run.driver_trip_id, run.travel_date, now],
        );
        await manager.query(
          `UPDATE ride_requests SET status = 'CANCELLED', cancelled_at = $3
            WHERE driver_trip_id = $1 AND travel_date = $2 AND status = 'ACCEPTED'`,
          [run.driver_trip_id, run.travel_date, now],
        );
        await manager.query(
          `UPDATE trip_occurrences SET reserved_seats = 0, updated_at = now()
            WHERE driver_trip_id = $1 AND travel_date = $2`,
          [run.driver_trip_id, run.travel_date],
        );
      }

      await manager.query(
        `UPDATE ride_requests SET status = 'CANCELLED', cancelled_at = $2
          WHERE status = 'PENDING' AND (sender_trip_id IN (SELECT id FROM trips WHERE student_id = $1)
            OR target_trip_id IN (SELECT id FROM trips WHERE student_id = $1))`,
        [student.id, now],
      );
      await manager.query(
        `UPDATE trips SET status = 'DELETED', deleted_at = $2, updated_at = $2
          WHERE student_id = $1 AND deleted_at IS NULL`,
        [student.id, now],
      );
      locked.accountStatus = AccountStatus.DELETED;
      locked.deletedAt = now;
      await manager.getRepository(Student).save(locked);
    });
    return { deleted: true };
  }
}
