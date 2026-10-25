import { describe, expect, it, vi } from 'vitest';
import type { FirebaseAdminService } from '../../common/firebase/firebase-admin.service.js';
import { LiveLocationService } from './live-location.service.js';

describe('LiveLocationService', () => {
  it('creates an active occurrence with the driver as the location owner', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const ref = vi.fn().mockReturnValue({ update });
    const firebase = {
      realtimeDatabase: { ref },
    } as unknown as FirebaseAdminService;
    const service = new LiveLocationService(firebase);
    const startedAt = new Date('2026-11-02T13:00:00.000Z');
    const expiresAt = new Date('2026-11-03T01:00:00.000Z');

    await service.activateOccurrence({
      driverTripId: 'driver-trip-id',
      travelDate: '2026-11-02',
      driverUid: 'driver-uid',
      passengerUids: ['passenger-uid'],
      startedAt,
      expiresAt,
    });

    expect(ref).toHaveBeenCalledWith('liveTrips/driver-trip-id_2026-11-02');
    expect(update).toHaveBeenCalledWith({
      meta: {
        driverTripId: 'driver-trip-id',
        travelDate: '2026-11-02',
        driverUid: 'driver-uid',
        status: 'ACTIVE',
        startedAt: startedAt.getTime(),
        expiresAt: expiresAt.getTime(),
      },
      members: { 'driver-uid': true, 'passenger-uid': true },
    });
  });

  it('removes passenger membership when a participant cancels', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const ref = vi.fn().mockReturnValue({ update });
    const firebase = {
      realtimeDatabase: { ref },
    } as unknown as FirebaseAdminService;
    const service = new LiveLocationService(firebase);

    await service.removeParticipant(
      'driver-trip-id',
      '2026-11-02',
      'firebase-uid',
    );

    expect(ref).toHaveBeenCalledWith('liveTrips/driver-trip-id_2026-11-02');
    expect(update).toHaveBeenCalledWith({
      'members/firebase-uid': null,
    });
  });

  it('deletes the complete occurrence when the driver cancels', async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const ref = vi.fn().mockReturnValue({ remove });
    const firebase = {
      realtimeDatabase: { ref },
    } as unknown as FirebaseAdminService;
    const service = new LiveLocationService(firebase);

    await service.closeOccurrence('driver-trip-id', '2026-11-02');

    expect(remove).toHaveBeenCalledOnce();
  });
});
