import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'trip_occurrences' })
export class TripOccurrence {
  @PrimaryColumn({ name: 'driver_trip_id', type: 'uuid' })
  driverTripId: string;

  @PrimaryColumn({ name: 'travel_date', type: 'date' })
  travelDate: string;

  @Column({ name: 'seat_capacity_snapshot', type: 'smallint' })
  seatCapacitySnapshot: number;

  @Column({ name: 'reserved_seats', type: 'smallint', default: 0 })
  reservedSeats: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
