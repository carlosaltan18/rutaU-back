import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RequestStatus, RequestType } from '../../../common/domain/enums.js';

@Entity({ name: 'ride_requests' })
@Index('idx_ride_request_sender_status', ['senderTripId', 'status'])
@Index('idx_ride_request_target_status', ['targetTripId', 'status'])
export class RideRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: RequestType, enumName: 'request_type_enum' })
  type: RequestType;

  @Column({ name: 'sender_trip_id', type: 'uuid' })
  senderTripId: string;

  @Column({ name: 'target_trip_id', type: 'uuid' })
  targetTripId: string;

  @Column({ name: 'driver_trip_id', type: 'uuid' })
  driverTripId: string;

  @Column({ name: 'passenger_trip_id', type: 'uuid' })
  passengerTripId: string;

  @Column({ name: 'travel_date', type: 'date' })
  travelDate: string;

  @Column({ name: 'requested_seats', type: 'smallint', default: 1 })
  requestedSeats: number;

  @Column({ name: 'offered_contribution_minor', type: 'bigint' })
  offeredContributionMinor: string;

  @Column({ type: 'char', length: 3, default: 'GTQ' })
  currency: 'GTQ';

  @Column({ type: 'varchar', length: 160, nullable: true })
  message: string | null;

  @Column({
    type: 'enum',
    enum: RequestStatus,
    enumName: 'request_status_enum',
  })
  status: RequestStatus;

  @Column({ name: 'pair_key', type: 'varchar', length: 73 })
  pairKey: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ name: 'expired_at', type: 'timestamptz', nullable: true })
  expiredAt: Date | null;
}
