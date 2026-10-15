import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1760328000000 implements MigrationInterface {
  name = 'InitialSchema1760328000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      CREATE TYPE account_status_enum AS ENUM
        ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'DELETED');
      CREATE TYPE trip_role_enum AS ENUM ('DRIVER', 'PASSENGER');
      CREATE TYPE trip_status_enum AS ENUM ('ACTIVE', 'INACTIVE', 'DELETED');
      CREATE TYPE request_type_enum AS ENUM ('JOIN_REQUEST', 'DRIVER_INVITATION');
      CREATE TYPE request_status_enum AS ENUM
        ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');
      CREATE TYPE coordination_status_enum AS ENUM
        ('CONFIRMED', 'CANCELLED', 'COMPLETED');
      CREATE TYPE notification_type_enum AS ENUM
        ('REQUEST_RECEIVED', 'REQUEST_ACCEPTED', 'REQUEST_REJECTED',
         'REQUEST_CANCELLED', 'REQUEST_EXPIRED', 'COORDINATION_CANCELLED');

      CREATE TABLE universities (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(160) NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE university_email_domains (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        university_id uuid NOT NULL REFERENCES universities(id),
        domain varchar(255) NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_university_email_domain UNIQUE (university_id, domain)
      );

      CREATE TABLE campuses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        university_id uuid NOT NULL REFERENCES universities(id),
        name varchar(160) NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_campus_university_name UNIQUE (university_id, name),
        CONSTRAINT uq_campus_university_id_id UNIQUE (university_id, id)
      );

      CREATE TABLE zones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(160) NOT NULL,
        municipality varchar(160) NOT NULL,
        department varchar(160) NOT NULL,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_zone_location UNIQUE (name, municipality, department)
      );

      CREATE TABLE students (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        auth_subject varchar(255) NOT NULL,
        display_name varchar(120) NOT NULL,
        photo_url varchar(2048),
        institutional_email varchar(255) NOT NULL,
        phone varchar(32),
        email_verified boolean NOT NULL DEFAULT false,
        university_id uuid NOT NULL REFERENCES universities(id),
        campus_id uuid NOT NULL,
        account_status account_status_enum NOT NULL DEFAULT 'PENDING_VERIFICATION',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        CONSTRAINT uq_students_auth_subject UNIQUE (auth_subject),
        CONSTRAINT fk_student_campus_university
          FOREIGN KEY (university_id, campus_id)
          REFERENCES campuses(university_id, id)
      );
      CREATE UNIQUE INDEX uq_students_active_email
        ON students (lower(institutional_email)) WHERE deleted_at IS NULL;

      CREATE TABLE trips (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES students(id),
        origin_zone_id uuid NOT NULL REFERENCES zones(id),
        destination_campus_id uuid NOT NULL REFERENCES campuses(id),
        day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
        departure_time time(0) NOT NULL,
        role trip_role_enum NOT NULL,
        seat_capacity smallint,
        status trip_status_enum NOT NULL DEFAULT 'ACTIVE',
        version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        CONSTRAINT ck_trip_capacity_by_role CHECK (
          (role = 'DRIVER' AND seat_capacity BETWEEN 1 AND 3)
          OR (role = 'PASSENGER' AND seat_capacity IS NULL)
        )
      );
      CREATE INDEX idx_trip_matching
        ON trips (origin_zone_id, destination_campus_id, day_of_week, departure_time)
        WHERE status = 'ACTIVE';
      CREATE INDEX idx_trip_owner_status ON trips (student_id, status);
      CREATE UNIQUE INDEX uq_trip_active_identity
        ON trips (student_id, origin_zone_id, destination_campus_id,
                  day_of_week, departure_time, role)
        WHERE status = 'ACTIVE' AND deleted_at IS NULL;

      CREATE TABLE trip_occurrences (
        driver_trip_id uuid NOT NULL REFERENCES trips(id),
        travel_date date NOT NULL,
        seat_capacity_snapshot smallint NOT NULL,
        reserved_seats smallint NOT NULL DEFAULT 0,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (driver_trip_id, travel_date),
        CONSTRAINT ck_occurrence_capacity CHECK (
          seat_capacity_snapshot BETWEEN 1 AND 3
          AND reserved_seats BETWEEN 0 AND seat_capacity_snapshot
        )
      );

      CREATE TABLE ride_requests (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        type request_type_enum NOT NULL,
        sender_trip_id uuid NOT NULL REFERENCES trips(id),
        target_trip_id uuid NOT NULL REFERENCES trips(id),
        driver_trip_id uuid NOT NULL REFERENCES trips(id),
        passenger_trip_id uuid NOT NULL REFERENCES trips(id),
        travel_date date NOT NULL,
        requested_seats smallint NOT NULL DEFAULT 1 CHECK (requested_seats = 1),
        offered_contribution_minor bigint NOT NULL
          CHECK (offered_contribution_minor >= 0),
        currency char(3) NOT NULL DEFAULT 'GTQ' CHECK (currency = 'GTQ'),
        message varchar(160),
        status request_status_enum NOT NULL DEFAULT 'PENDING',
        pair_key varchar(73) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        responded_at timestamptz,
        cancelled_at timestamptz,
        expired_at timestamptz,
        CONSTRAINT ck_request_different_trips CHECK (sender_trip_id <> target_trip_id),
        CONSTRAINT ck_request_driver_passenger CHECK (driver_trip_id <> passenger_trip_id)
      );
      CREATE UNIQUE INDEX uq_ride_request_active_pair_date
        ON ride_requests (pair_key, travel_date)
        WHERE status IN ('PENDING', 'ACCEPTED');
      CREATE INDEX idx_ride_request_sender_status ON ride_requests (sender_trip_id, status);
      CREATE INDEX idx_ride_request_target_status ON ride_requests (target_trip_id, status);

      CREATE TABLE coordinations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ride_request_id uuid NOT NULL UNIQUE REFERENCES ride_requests(id),
        driver_student_id uuid NOT NULL REFERENCES students(id),
        passenger_student_id uuid NOT NULL REFERENCES students(id),
        driver_trip_id uuid NOT NULL REFERENCES trips(id),
        passenger_trip_id uuid NOT NULL REFERENCES trips(id),
        travel_date date NOT NULL,
        planned_departure_time time(0) NOT NULL,
        origin_zone_id uuid NOT NULL REFERENCES zones(id),
        destination_campus_id uuid NOT NULL REFERENCES campuses(id),
        agreed_contribution_minor bigint NOT NULL
          CHECK (agreed_contribution_minor >= 0),
        currency char(3) NOT NULL DEFAULT 'GTQ' CHECK (currency = 'GTQ'),
        status coordination_status_enum NOT NULL DEFAULT 'CONFIRMED',
        created_at timestamptz NOT NULL DEFAULT now(),
        cancelled_at timestamptz,
        completed_at timestamptz,
        CONSTRAINT ck_coordination_participants CHECK
          (driver_student_id <> passenger_student_id)
      );
      CREATE INDEX idx_coordination_driver_date
        ON coordinations (driver_trip_id, travel_date, status);
      CREATE INDEX idx_coordination_passenger
        ON coordinations (passenger_student_id, status);

      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES students(id),
        type notification_type_enum NOT NULL,
        resource_id uuid,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        read_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_notification_student_created
        ON notifications (student_id, created_at DESC, id DESC);

      CREATE TABLE device_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES students(id),
        token varchar(512) NOT NULL UNIQUE,
        platform varchar(16) NOT NULL DEFAULT 'ANDROID',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE idempotency_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id uuid NOT NULL REFERENCES students(id),
        endpoint varchar(200) NOT NULL,
        key varchar(200) NOT NULL,
        payload_hash char(64) NOT NULL,
        response_status smallint NOT NULL,
        response_body jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL,
        CONSTRAINT uq_idempotency_actor_endpoint_key
          UNIQUE (student_id, endpoint, key)
      );
      CREATE INDEX idx_idempotency_expiry ON idempotency_keys (expires_at);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS idempotency_keys;
      DROP TABLE IF EXISTS device_tokens;
      DROP TABLE IF EXISTS notifications;
      DROP TABLE IF EXISTS coordinations;
      DROP TABLE IF EXISTS ride_requests;
      DROP TABLE IF EXISTS trip_occurrences;
      DROP TABLE IF EXISTS trips;
      DROP TABLE IF EXISTS students;
      DROP TABLE IF EXISTS zones;
      DROP TABLE IF EXISTS campuses;
      DROP TABLE IF EXISTS university_email_domains;
      DROP TABLE IF EXISTS universities;
      DROP TYPE IF EXISTS notification_type_enum;
      DROP TYPE IF EXISTS coordination_status_enum;
      DROP TYPE IF EXISTS request_status_enum;
      DROP TYPE IF EXISTS request_type_enum;
      DROP TYPE IF EXISTS trip_status_enum;
      DROP TYPE IF EXISTS trip_role_enum;
      DROP TYPE IF EXISTS account_status_enum;
    `);
  }
}
