import type { Trip } from './entities/trip.entity.js';

export function toTripDto(trip: Trip) {
  return {
    id: trip.id,
    originZoneId: trip.originZoneId,
    destinationCampusId: trip.destinationCampusId,
    dayOfWeek: trip.dayOfWeek,
    departureTime: trip.departureTime.slice(0, 5),
    role: trip.role,
    seatCapacity: trip.seatCapacity,
    status: trip.status,
    version: trip.version,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}
