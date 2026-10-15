import { Column, Entity, Unique } from 'typeorm';
import { UuidEntity } from '../../../common/database/entities/base.entity.js';

@Entity({ name: 'zones' })
@Unique('uq_zone_location', ['name', 'municipality', 'department'])
export class Zone extends UuidEntity {
  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 160 })
  municipality: string;

  @Column({ type: 'varchar', length: 160 })
  department: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;
}
