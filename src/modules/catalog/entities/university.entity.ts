import { Column, Entity, Unique } from 'typeorm';
import { UuidEntity } from '../../../common/database/entities/base.entity.js';

@Entity({ name: 'universities' })
export class University extends UuidEntity {
  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}

@Entity({ name: 'university_email_domains' })
@Unique('uq_university_email_domain', ['universityId', 'domain'])
export class UniversityEmailDomain extends UuidEntity {
  @Column({ name: 'university_id', type: 'uuid' })
  universityId: string;

  @Column({ type: 'varchar', length: 255 })
  domain: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
