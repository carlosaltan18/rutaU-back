import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainException } from '../../common/errors/domain.exception.js';
import { IdempotencyService } from '../../common/idempotency/idempotency.service.js';
import {
  decodeCursor,
  encodeCursor,
} from '../../common/pagination/pagination.dto.js';
import type { Student } from '../students/entities/student.entity.js';
import type {
  NotificationQueryDto,
  RegisterDeviceDto,
} from './dto/notification.dto.js';
import { DeviceToken, Notification } from './entities/notification.entity.js';

interface NotificationCursor extends Record<string, string> {
  createdAt: string;
  id: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private readonly devices: Repository<DeviceToken>,
    private readonly idempotency: IdempotencyService,
  ) {}

  async list(student: Student, query: NotificationQueryDto) {
    const cursor = decodeCursor<NotificationCursor>(query.cursor);
    const builder = this.notifications
      .createQueryBuilder('notification')
      .where('notification.student_id = :studentId', { studentId: student.id })
      .orderBy('notification.created_at', 'DESC')
      .addOrderBy('notification.id', 'DESC')
      .take(query.limit + 1);
    if (cursor) {
      builder.andWhere(
        '(notification.created_at, notification.id) < (:createdAt, :id)',
        cursor,
      );
    }
    const rows = await builder.getMany();
    const hasMore = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        hasMore && last
          ? encodeCursor({
              createdAt: last.createdAt.toISOString(),
              id: last.id,
            })
          : null,
    };
  }

  async markRead(student: Student, id: string) {
    const notification = await this.notifications.findOneBy({
      id,
      studentId: student.id,
    });
    if (!notification) {
      throw new DomainException(
        'FORBIDDEN',
        'Notificación no encontrada.',
        HttpStatus.NOT_FOUND,
      );
    }
    notification.readAt ??= new Date();
    return this.notifications.save(notification);
  }

  registerDevice(
    student: Student,
    input: RegisterDeviceDto,
    idempotencyKey?: string,
  ) {
    return this.idempotency.execute(
      student.id,
      'POST:/devices',
      idempotencyKey,
      input,
      async (manager) => {
        const repository = manager.getRepository(DeviceToken);
        let device = await repository.findOneBy({ token: input.token });
        if (device) {
          device.studentId = student.id;
          device.platform = input.platform;
        } else {
          device = repository.create({ ...input, studentId: student.id });
        }
        const saved = await repository.save(device);
        return { id: saved.id, platform: saved.platform };
      },
    );
  }

  async deleteDevice(student: Student, id: string) {
    const result = await this.devices.delete({ id, studentId: student.id });
    if (!result.affected) {
      throw new DomainException(
        'FORBIDDEN',
        'Dispositivo no encontrado.',
        HttpStatus.NOT_FOUND,
      );
    }
    return { deleted: true };
  }
}
