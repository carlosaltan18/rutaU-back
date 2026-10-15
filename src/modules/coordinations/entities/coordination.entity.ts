import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CoordinationStatus } from '../../../common/domain/enums.js';

@Entity({ name: 'coordinations' })
@Index('uq_coordination_request', ['rideRequestId'], { unique: true })
export class Coordination {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ride_request_id', type: 'uuid' })
  rideRequestId: string;

  @Column({ name: 'driver_student_id', type: 'uuid' })
  driverStudentId: string;

  @Column({ name: 'passenger_student_id', type: 'uuid' })
  passengerStudentId: string;

  @Column({ name: 'driver_trip_id', type: 'uuid' })
  driverTripId: string;

  @Column({ name: 'passenger_trip_id', type: 'uuid' })
  passengerTripId: string;

  @Column({ name: 'travel_date', type: 'date' })
  travelDate: string;

  @Column({ name: 'planned_departure_time', type: 'time', precision: 0 })
  plannedDepartureTime: string;

  @Column({ name: 'origin_zone_id', type: 'uuid' })
  originZoneId: string;

  @Column({ name: 'destination_campus_id', type: 'uuid' })
  destinationCampusId: string;

  @Column({ name: 'agreed_contribution_minor', type: 'bigint' })
  agreedContributionMinor: string;

  @Column({ type: 'char', length: 3, default: 'GTQ' })
  currency: 'GTQ';

  @Column({
    type: 'enum',
    enum: CoordinationStatus,
    enumName: 'coordination_status_enum',
  })
  status: CoordinationStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;
}
