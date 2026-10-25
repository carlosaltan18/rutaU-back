import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLiveTripLifecycle1792891000000 implements MigrationInterface {
  name = 'AddLiveTripLifecycle1792891000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE trip_occurrences
        ADD COLUMN live_started_at timestamptz,
        ADD COLUMN live_ended_at timestamptz;

      CREATE INDEX idx_trip_occurrence_live_active
        ON trip_occurrences (live_started_at)
        WHERE live_started_at IS NOT NULL AND live_ended_at IS NULL;

      ALTER TABLE trip_occurrences
        ADD CONSTRAINT ck_trip_occurrence_live_lifecycle CHECK (
          live_ended_at IS NULL
          OR (live_started_at IS NOT NULL AND live_ended_at >= live_started_at)
        );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE trip_occurrences
        DROP CONSTRAINT IF EXISTS ck_trip_occurrence_live_lifecycle;
      DROP INDEX IF EXISTS idx_trip_occurrence_live_active;
      ALTER TABLE trip_occurrences
        DROP COLUMN IF EXISTS live_ended_at,
        DROP COLUMN IF EXISTS live_started_at;
    `);
  }
}
