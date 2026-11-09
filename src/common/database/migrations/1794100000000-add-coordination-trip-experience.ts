import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Guarda llegada, motivo de cancelación, aporte y recordatorios del viaje. */
export class AddCoordinationTripExperience1794100000000
  implements MigrationInterface
{
  name = 'AddCoordinationTripExperience1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE coordination_cancellation_reason_enum AS ENUM (
        'NO_LONGER_NEEDED',
        'SCHEDULE_CHANGE',
        'EMERGENCY',
        'OTHER'
      );
    `);
    await queryRunner.query(`
      ALTER TABLE coordinations
        ADD COLUMN cancellation_reason coordination_cancellation_reason_enum,
        ADD COLUMN driver_arrived_at timestamptz,
        ADD COLUMN passenger_arrived_at timestamptz,
        ADD COLUMN driver_contribution_confirmed_at timestamptz,
        ADD COLUMN passenger_contribution_confirmed_at timestamptz;
    `);
    await queryRunner.query(`
      ALTER TABLE trip_occurrences
        ADD COLUMN reminder_30_sent_at timestamptz,
        ADD COLUMN reminder_10_sent_at timestamptz;
    `);
    await queryRunner.query(`
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'COORDINATION_ARRIVAL';
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'TRIP_REMINDER_30_MINUTES';
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'TRIP_REMINDER_10_MINUTES';
      ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'CONTRIBUTION_CONFIRMED';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE trip_occurrences
        DROP COLUMN IF EXISTS reminder_10_sent_at,
        DROP COLUMN IF EXISTS reminder_30_sent_at;
    `);
    await queryRunner.query(`
      ALTER TABLE coordinations
        DROP COLUMN IF EXISTS passenger_contribution_confirmed_at,
        DROP COLUMN IF EXISTS driver_contribution_confirmed_at,
        DROP COLUMN IF EXISTS passenger_arrived_at,
        DROP COLUMN IF EXISTS driver_arrived_at,
        DROP COLUMN IF EXISTS cancellation_reason;
    `);
    await queryRunner.query(
      'DROP TYPE IF EXISTS coordination_cancellation_reason_enum;',
    );
  }
}
