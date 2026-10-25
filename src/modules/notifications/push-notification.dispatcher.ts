import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { MulticastMessage } from 'firebase-admin/messaging';
import { DataSource, In, Repository } from 'typeorm';
import { NotificationType } from '../../common/domain/enums.js';
import { FirebaseAdminService } from '../../common/firebase/firebase-admin.service.js';
import { DeviceToken, Notification } from './entities/notification.entity.js';

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

const COPY: Record<NotificationType, { title: string; body: string }> = {
  [NotificationType.REQUEST_RECEIVED]: {
    title: 'Nueva solicitud de viaje',
    body: 'Tienes una nueva solicitud o invitación.',
  },
  [NotificationType.REQUEST_ACCEPTED]: {
    title: 'Solicitud aceptada',
    body: 'Tu solicitud fue aceptada. Ya puedes ver la coordinación.',
  },
  [NotificationType.REQUEST_REJECTED]: {
    title: 'Solicitud rechazada',
    body: 'La otra persona rechazó la solicitud.',
  },
  [NotificationType.REQUEST_CANCELLED]: {
    title: 'Solicitud cancelada',
    body: 'La solicitud fue cancelada.',
  },
  [NotificationType.REQUEST_EXPIRED]: {
    title: 'Solicitud expirada',
    body: 'La solicitud expiró antes de ser aceptada.',
  },
  [NotificationType.COORDINATION_CANCELLED]: {
    title: 'Coordinación cancelada',
    body: 'Un participante canceló la coordinación del viaje.',
  },
};

export function buildPushMessage(
  notification: Pick<Notification, 'id' | 'type' | 'resourceId'>,
  tokens: string[],
): MulticastMessage {
  const copy = COPY[notification.type];
  const isCoordination =
    notification.type === NotificationType.COORDINATION_CANCELLED;
  return {
    tokens,
    notification: copy,
    data: {
      notificationId: notification.id,
      type: notification.type,
      resourceId: notification.resourceId ?? '',
      destination: isCoordination
        ? 'COORDINATION_DETAIL'
        : 'RIDE_REQUEST_DETAIL',
    },
    android: {
      priority: 'high',
      notification: { channelId: 'rutau_updates' },
    },
  };
}

@Injectable()
export class PushNotificationDispatcher {
  private readonly logger = new Logger(PushNotificationDispatcher.name);
  private readonly enabled: boolean;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private readonly devices: Repository<DeviceToken>,
    private readonly firebase: FirebaseAdminService,
    config: ConfigService,
  ) {
    this.enabled = config.get<string>('FCM_ENABLED', 'false') === 'true';
  }

  @Cron('*/10 * * * * *', { name: 'dispatch-fcm-notifications' })
  async dispatchPending(): Promise<void> {
    if (!this.enabled) return;
    const batch = await this.claimBatch();
    for (const notification of batch) {
      await this.dispatch(notification);
    }
  }

  private claimBatch(): Promise<Notification[]> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(Notification);
      const rows = await repository
        .createQueryBuilder('notification')
        .where('notification.push_sent_at IS NULL')
        .andWhere('notification.push_attempts < 5')
        .andWhere('notification.push_next_attempt_at <= now()')
        .orderBy('notification.created_at', 'ASC')
        .addOrderBy('notification.id', 'ASC')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .take(25)
        .getMany();
      const nextAttempt = new Date(Date.now() + 5 * 60 * 1000);
      for (const row of rows) {
        row.pushAttempts += 1;
        row.pushNextAttemptAt = nextAttempt;
      }
      return repository.save(rows);
    });
  }

  private async dispatch(notification: Notification): Promise<void> {
    const devices = await this.devices.findBy({
      studentId: notification.studentId,
    });
    if (!devices.length) {
      await this.markSent(notification.id);
      return;
    }

    const invalidTokens: string[] = [];
    let delivered = false;
    let transientErrors = 0;
    try {
      for (let index = 0; index < devices.length; index += 500) {
        const tokens = devices
          .slice(index, index + 500)
          .map(({ token }) => token);
        const response = await this.firebase.messaging.sendEachForMulticast(
          buildPushMessage(notification, tokens),
        );
        delivered ||= response.successCount > 0;
        response.responses.forEach((result, responseIndex) => {
          if (result.success) return;
          const code = result.error?.code;
          if (code && INVALID_TOKEN_CODES.has(code)) {
            invalidTokens.push(tokens[responseIndex]);
          } else {
            transientErrors += 1;
          }
        });
      }

      if (invalidTokens.length) {
        await this.devices.delete({ token: In(invalidTokens) });
      }
      if (delivered || transientErrors === 0) {
        await this.markSent(notification.id);
      } else {
        await this.markFailed(
          notification.id,
          `${transientErrors} FCM deliveries failed`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown FCM error';
      await this.markFailed(notification.id, message);
      this.logger.warn(
        `FCM delivery failed for notification ${notification.id}`,
      );
    }
  }

  private markSent(id: string) {
    return this.notifications.update(id, {
      pushSentAt: new Date(),
      pushLastError: null,
    });
  }

  private markFailed(id: string, error: string) {
    return this.notifications.update(id, {
      pushLastError: error.slice(0, 500),
    });
  }
}
