import { Injectable } from '@nestjs/common';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service.js';

@Injectable()
export class LiveLocationService {
  constructor(private readonly firebase: FirebaseAdminService) {}

  occurrenceId(driverTripId: string, travelDate: string): string {
    return `${driverTripId}_${travelDate}`;
  }

  async activateOccurrence(input: {
    driverTripId: string;
    travelDate: string;
    driverUid: string;
    passengerUids: string[];
    startedAt: Date;
    expiresAt: Date;
  }): Promise<void> {
    const occurrenceId = this.occurrenceId(
      input.driverTripId,
      input.travelDate,
    );
    const members = Object.fromEntries(
      [input.driverUid, ...input.passengerUids].map((uid) => [uid, true]),
    );
    await this.firebase.realtimeDatabase
      .ref(`liveTrips/${occurrenceId}`)
      .update({
        meta: {
          driverTripId: input.driverTripId,
          travelDate: input.travelDate,
          driverUid: input.driverUid,
          status: 'ACTIVE',
          startedAt: input.startedAt.getTime(),
          expiresAt: input.expiresAt.getTime(),
        },
        members,
      });
  }

  async removeParticipant(
    driverTripId: string,
    travelDate: string,
    firebaseUid: string,
  ): Promise<void> {
    const occurrenceId = this.occurrenceId(driverTripId, travelDate);
    await this.firebase.realtimeDatabase
      .ref(`liveTrips/${occurrenceId}`)
      .update({
        [`members/${firebaseUid}`]: null,
      });
  }

  async closeOccurrence(
    driverTripId: string,
    travelDate: string,
  ): Promise<void> {
    const occurrenceId = this.occurrenceId(driverTripId, travelDate);
    await this.firebase.realtimeDatabase
      .ref(`liveTrips/${occurrenceId}`)
      .remove();
  }
}
