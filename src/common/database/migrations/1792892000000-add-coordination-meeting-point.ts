import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Agrega el punto de encuentro y las confirmaciones de ambos participantes. */
export class AddCoordinationMeetingPoint1792892000000
  implements MigrationInterface
{
  name = 'AddCoordinationMeetingPoint1792892000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coordinations
        ADD COLUMN meeting_point varchar(240),
        ADD COLUMN driver_meeting_point_confirmed_at timestamptz,
        ADD COLUMN passenger_meeting_point_confirmed_at timestamptz;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coordinations
        DROP COLUMN IF EXISTS passenger_meeting_point_confirmed_at,
        DROP COLUMN IF EXISTS driver_meeting_point_confirmed_at,
        DROP COLUMN IF EXISTS meeting_point;
    `);
  }
}
