import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Agrega las coordenadas del punto de encuentro elegido en el mapa. */
export class AddCoordinationMeetingCoordinates1792893000000
  implements MigrationInterface
{
  name = 'AddCoordinationMeetingCoordinates1792893000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coordinations
        ADD COLUMN meeting_latitude double precision,
        ADD COLUMN meeting_longitude double precision,
        ADD CONSTRAINT ck_coordination_meeting_coordinates
          CHECK (
            (meeting_latitude IS NULL AND meeting_longitude IS NULL)
            OR (
              meeting_latitude BETWEEN -90 AND 90
              AND meeting_longitude BETWEEN -180 AND 180
            )
          );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE coordinations
        DROP CONSTRAINT IF EXISTS ck_coordination_meeting_coordinates,
        DROP COLUMN IF EXISTS meeting_longitude,
        DROP COLUMN IF EXISTS meeting_latitude;
    `);
  }
}
