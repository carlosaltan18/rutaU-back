import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPushDelivery1792890000000 implements MigrationInterface {
  name = 'AddPushDelivery1792890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE notifications
        ADD COLUMN push_sent_at timestamptz,
        ADD COLUMN push_attempts smallint NOT NULL DEFAULT 0,
        ADD COLUMN push_next_attempt_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN push_last_error varchar(500);

      CREATE INDEX idx_notification_push_pending
        ON notifications (push_next_attempt_at, created_at, id)
        WHERE push_sent_at IS NULL AND push_attempts < 5;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_notification_push_pending;
      ALTER TABLE notifications
        DROP COLUMN IF EXISTS push_last_error,
        DROP COLUMN IF EXISTS push_next_attempt_at,
        DROP COLUMN IF EXISTS push_attempts,
        DROP COLUMN IF EXISTS push_sent_at;
    `);
  }
}
