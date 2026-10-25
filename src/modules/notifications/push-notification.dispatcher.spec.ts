import { describe, expect, it } from 'vitest';
import { NotificationType } from '../../common/domain/enums.js';
import { buildPushMessage } from './push-notification.dispatcher.js';

describe('FCM notification contract', () => {
  it('routes request notifications to the request detail', () => {
    const message = buildPushMessage(
      {
        id: 'notification-1',
        type: NotificationType.REQUEST_ACCEPTED,
        resourceId: 'request-1',
      },
      ['device-token'],
    );

    expect(message.data).toEqual({
      notificationId: 'notification-1',
      type: 'REQUEST_ACCEPTED',
      resourceId: 'request-1',
      destination: 'RIDE_REQUEST_DETAIL',
    });
    expect(message.android?.notification?.channelId).toBe('rutau_updates');
  });

  it('routes cancellation notifications to the coordination detail', () => {
    const message = buildPushMessage(
      {
        id: 'notification-2',
        type: NotificationType.COORDINATION_CANCELLED,
        resourceId: 'coordination-1',
      },
      ['device-token'],
    );

    expect(message.data?.destination).toBe('COORDINATION_DETAIL');
  });
});
