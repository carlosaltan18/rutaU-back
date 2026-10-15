import { Column, Entity, Unique } from 'typeorm';
import { UuidEntity } from '../../../common/database/entities/base.entity.js';

@Entity({ name: 'campuses' })
@Unique('uq_campus_university_name', ['universityId', 'name'])
@Unique('uq_campus_university_id_id', ['universityId', 'id'])
export class Campus extends UuidEntity {
  @Column({ name: 'university_id', type: 'uuid' })
  universityId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
