import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NotificationType } from '../../../common/domain/enums.js';

@Entity({ name: 'notifications' })
@Index('idx_notification_student_created', ['studentId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type_enum',
  })
  type: NotificationType;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload: Record<string, unknown>;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'push_sent_at', type: 'timestamptz', nullable: true })
  pushSentAt: Date | null;

  @Column({ name: 'push_attempts', type: 'smallint', default: 0 })
  pushAttempts: number;

  @Column({
    name: 'push_next_attempt_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  pushNextAttemptAt: Date;

  @Column({
    name: 'push_last_error',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  pushLastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

@Entity({ name: 'device_tokens' })
@Index('uq_device_token', ['token'], { unique: true })
export class DeviceToken extends UuidEntity {
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @Column({ type: 'varchar', length: 512 })
  token: string;

  @Column({ type: 'varchar', length: 16, default: 'ANDROID' })
  platform: string;
}

import { UuidEntity } from '../../../common/database/entities/base.entity.js';
