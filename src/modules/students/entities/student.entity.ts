import { Column, DeleteDateColumn, Entity, Index } from 'typeorm';
import { UuidEntity } from '../../../common/database/entities/base.entity.js';
import { AccountStatus } from '../../../common/domain/enums.js';

@Entity({ name: 'students' })
@Index('uq_students_auth_subject', ['authSubject'], { unique: true })
export class Student extends UuidEntity {
  @Column({ name: 'auth_subject', type: 'varchar', length: 255 })
  authSubject: string;

  @Column({ name: 'display_name', type: 'varchar', length: 120 })
  displayName: string;

  @Column({ name: 'photo_url', type: 'varchar', length: 2048, nullable: true })
  photoUrl: string | null;

  @Column({ name: 'institutional_email', type: 'varchar', length: 255 })
  institutionalEmail: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ name: 'university_id', type: 'uuid' })
  universityId: string;

  @Column({ name: 'campus_id', type: 'uuid' })
  campusId: string;

  @Column({
    name: 'account_status',
    type: 'enum',
    enum: AccountStatus,
    enumName: 'account_status_enum',
  })
  accountStatus: AccountStatus;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
