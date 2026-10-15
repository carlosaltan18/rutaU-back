import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { UuidEntity } from '../../../common/database/entities/base.entity.js';
import { TripRole, TripStatus } from '../../../common/domain/enums.js';

@Entity({ name: 'trips' })
@Index('idx_trip_matching', [
  'originZoneId',
  'destinationCampusId',
  'dayOfWeek',
  'departureTime',
])
@Index('idx_trip_owner_status', ['studentId', 'status'])
export class Trip extends UuidEntity {
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ name: 'origin_zone_id', type: 'uuid' })
  originZoneId: string;

  @Column({ name: 'destination_campus_id', type: 'uuid' })
  destinationCampusId: string;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  @Column({ name: 'departure_time', type: 'time', precision: 0 })
  departureTime: string;

  @Column({ type: 'enum', enum: TripRole, enumName: 'trip_role_enum' })
  role: TripRole;

  @Column({ name: 'seat_capacity', type: 'smallint', nullable: true })
  seatCapacity: number | null;

  @Column({ type: 'enum', enum: TripStatus, enumName: 'trip_status_enum' })
  status: TripStatus;

  @Column({ type: 'integer', default: 1 })
  version: number;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
