import { Injectable } from '@nestjs/common';
import {
  MATCH_REASONS,
  TripRole,
  type MatchReason,
} from '../../common/domain/enums.js';
import { timeDifferenceMinutes } from '../../common/time/business-time.js';

export interface CompatibleTrip {
  id: string;
  studentId: string;
  originZoneId: string;
  destinationCampusId: string;
  dayOfWeek: number;
  departureTime: string;
  role: TripRole;
}

export interface CompatibilityResult {
  compatible: boolean;
  timeDifferenceMinutes: number;
  reasons: MatchReason[];
}

@Injectable()
export class CompatibilityPolicy {
  evaluate(
    source: CompatibleTrip,
    candidate: CompatibleTrip,
    availableSeats: number,
  ): CompatibilityResult {
    const difference = timeDifferenceMinutes(
      source.departureTime,
      candidate.departureTime,
    );
    const differentStudent = source.studentId !== candidate.studentId;
    const sameZone = source.originZoneId === candidate.originZoneId;
    const sameCampus =
      source.destinationCampusId === candidate.destinationCampusId;
    const sameDay = source.dayOfWeek === candidate.dayOfWeek;
    const withinTime = difference <= 30;
    const complementary = source.role !== candidate.role;
    const seatsAvailable = availableSeats > 0;

    const reasons: MatchReason[] = [];
    if (sameZone) reasons.push(MATCH_REASONS[0]);
    if (sameCampus) reasons.push(MATCH_REASONS[1]);
    if (sameDay) reasons.push(MATCH_REASONS[2]);
    if (withinTime) reasons.push(MATCH_REASONS[3]);
    if (complementary) reasons.push(MATCH_REASONS[4]);
    if (seatsAvailable) reasons.push(MATCH_REASONS[5]);

    return {
      compatible:
        differentStudent &&
        sameZone &&
        sameCampus &&
        sameDay &&
        withinTime &&
        complementary &&
        seatsAvailable,
      timeDifferenceMinutes: difference,
      reasons,
    };
  }
}
