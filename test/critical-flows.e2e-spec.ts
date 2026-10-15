import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/bootstrap.js';

const DRIVER_TRIP = '50000000-0000-4000-8000-000000000004';
const DRIVER_STUDENT = '40000000-0000-4000-8000-000000000004';
const PASSENGER_TRIPS = [
  '50000000-0000-4000-8000-000000000005',
  '50000000-0000-4000-8000-000000000006',
  '50000000-0000-4000-8000-000000000007',
];
const PASSENGER_STUDENTS = [
  '40000000-0000-4000-8000-000000000005',
  '40000000-0000-4000-8000-000000000006',
  '40000000-0000-4000-8000-000000000007',
];

describe.sequential('Flujos críticos PostgreSQL', () => {
  let app: INestApplication<App>;
  let database: DataSource;
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET,
    signOptions: { issuer: 'rutau-local', expiresIn: '10m' },
  });

  const tokenFor = (number: number) =>
    jwt.sign({ sub: `demo-student-${number}` });
  const futureMonday = (weeks: number) => {
    const today = DateTime.now().setZone('America/Guatemala').startOf('day');
    let days = (1 - today.weekday + 7) % 7;
    if (days === 0) days = 7;
    return today.plus({ days: days + weeks * 7 }).toISODate()!;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
    database = app.get(DataSource);
  }, 90_000);

  afterAll(async () => app.close());

  async function createRequest(passengerIndex: number, travelDate: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ride-requests')
      .set('Authorization', `Bearer ${tokenFor(passengerIndex + 5)}`)
      .send({
        senderTripId: PASSENGER_TRIPS[passengerIndex],
        targetTripId: DRIVER_TRIP,
        type: 'JOIN_REQUEST',
        travelDate,
        offeredContributionMinor: 1000,
        currency: 'GTQ',
        message: `E2E crítico ${travelDate}`,
      })
      .expect(201);
    return response.body.data as { id: string };
  }

  async function cleanup(
    requestIds: string[],
    travelDate: string,
    extraResourceIds: string[] = [],
  ) {
    const resources = [...requestIds, ...extraResourceIds];
    if (resources.length) {
      await database.query(
        'DELETE FROM notifications WHERE resource_id = ANY($1::uuid[])',
        [resources],
      );
    }
    if (requestIds.length) {
      await database.query(
        'DELETE FROM coordinations WHERE ride_request_id = ANY($1::uuid[])',
        [requestIds],
      );
      await database.query(
        'DELETE FROM ride_requests WHERE id = ANY($1::uuid[])',
        [requestIds],
      );
    }
    await database.query(
      'DELETE FROM trip_occurrences WHERE driver_trip_id = $1 AND travel_date = $2',
      [DRIVER_TRIP, travelDate],
    );
  }

  async function cleanupDate(travelDate: string) {
    const rows = await database.query<Array<{ id: string }>>(
      `SELECT id FROM ride_requests
        WHERE travel_date = $1 AND message = $2`,
      [travelDate, `E2E crítico ${travelDate}`],
    );
    await cleanup(
      rows.map((row) => row.id),
      travelDate,
    );
  }

  it('solo permite una aceptación simultánea para la última plaza', async () => {
    const date = futureMonday(5);
    const requestIds: string[] = [];
    try {
      await cleanupDate(date);
      requestIds.push((await createRequest(0, date)).id);
      requestIds.push((await createRequest(1, date)).id);
      await database.query(
        `INSERT INTO trip_occurrences
          (driver_trip_id, travel_date, seat_capacity_snapshot, reserved_seats)
         VALUES ($1, $2, 3, 2)`,
        [DRIVER_TRIP, date],
      );

      const responses = await Promise.all(
        requestIds.map((id) =>
          request(app.getHttpServer())
            .post(`/api/v1/ride-requests/${id}/accept`)
            .set('Authorization', `Bearer ${tokenFor(4)}`),
        ),
      );
      expect(responses.map((item) => item.status).sort()).toEqual([201, 409]);
      expect(
        responses.find((item) => item.status === 409)?.body.error.code,
      ).toBe('NO_SEATS_AVAILABLE');
      const [{ reserved_seats: reservedSeats }] = await database.query<
        Array<{ reserved_seats: number }>
      >(
        `SELECT reserved_seats FROM trip_occurrences
          WHERE driver_trip_id = $1 AND travel_date = $2`,
        [DRIVER_TRIP, date],
      );
      expect(Number(reservedSeats)).toBe(3);
      const [{ count }] = await database.query<Array<{ count: string }>>(
        `SELECT COUNT(*)::text AS count FROM ride_requests
          WHERE id = ANY($1::uuid[]) AND status = 'ACCEPTED'`,
        [requestIds],
      );
      expect(Number(count)).toBe(1);
    } finally {
      await cleanup(requestIds, date);
    }
  });

  it('revierte solicitud y cupo si falla la creación de coordinación', async () => {
    const date = futureMonday(6);
    await cleanupDate(date);
    const created = await createRequest(0, date);
    const fakeCoordinationId = randomUUID();
    try {
      await database.query(
        `INSERT INTO coordinations
          (id, ride_request_id, driver_student_id, passenger_student_id,
           driver_trip_id, passenger_trip_id, travel_date, planned_departure_time,
           origin_zone_id, destination_campus_id, agreed_contribution_minor,
           currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '07:00',
           '30000000-0000-4000-8000-000000000001',
           '20000000-0000-4000-8000-000000000001', 1000, 'GTQ', 'CONFIRMED')`,
        [
          fakeCoordinationId,
          created.id,
          DRIVER_STUDENT,
          PASSENGER_STUDENTS[0],
          DRIVER_TRIP,
          PASSENGER_TRIPS[0],
          date,
        ],
      );
      const response = await request(app.getHttpServer())
        .post(`/api/v1/ride-requests/${created.id}/accept`)
        .set('Authorization', `Bearer ${tokenFor(4)}`)
        .expect(500);
      expect(response.body.error.code).toBe('INTERNAL_ERROR');
      const [state] = await database.query<Array<{ status: string }>>(
        'SELECT status FROM ride_requests WHERE id = $1',
        [created.id],
      );
      expect(state.status).toBe('PENDING');
      const [{ count }] = await database.query<Array<{ count: string }>>(
        `SELECT COUNT(*)::text AS count FROM trip_occurrences
          WHERE driver_trip_id = $1 AND travel_date = $2`,
        [DRIVER_TRIP, date],
      );
      expect(Number(count)).toBe(0);
    } finally {
      await database.query('DELETE FROM coordinations WHERE id = $1', [
        fakeCoordinationId,
      ]);
      await cleanup([created.id], date);
    }
  });

  it('cancelar participación del pasajero libera una plaza', async () => {
    const date = futureMonday(7);
    await cleanupDate(date);
    const created = await createRequest(0, date);
    let coordinationId: string | undefined;
    try {
      const accepted = await request(app.getHttpServer())
        .post(`/api/v1/ride-requests/${created.id}/accept`)
        .set('Authorization', `Bearer ${tokenFor(4)}`)
        .expect(201);
      coordinationId = accepted.body.data.coordination.id;
      await request(app.getHttpServer())
        .post(`/api/v1/coordinations/${coordinationId}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(5)}`)
        .expect(201);
      const [occurrence] = await database.query<
        Array<{ reserved_seats: number }>
      >(
        `SELECT reserved_seats FROM trip_occurrences
          WHERE driver_trip_id = $1 AND travel_date = $2`,
        [DRIVER_TRIP, date],
      );
      expect(Number(occurrence.reserved_seats)).toBe(0);
    } finally {
      await cleanup([created.id], date, coordinationId ? [coordinationId] : []);
    }
  });

  it('cancelar el viaje del conductor libera todas las plazas de la fecha', async () => {
    const date = futureMonday(8);
    const requestIds: string[] = [];
    const coordinationIds: string[] = [];
    try {
      await cleanupDate(date);
      requestIds.push((await createRequest(0, date)).id);
      requestIds.push((await createRequest(1, date)).id);
      for (const requestId of requestIds) {
        const accepted = await request(app.getHttpServer())
          .post(`/api/v1/ride-requests/${requestId}/accept`)
          .set('Authorization', `Bearer ${tokenFor(4)}`)
          .expect(201);
        coordinationIds.push(accepted.body.data.coordination.id);
      }
      await request(app.getHttpServer())
        .post(`/api/v1/coordinations/${coordinationIds[0]}/cancel`)
        .set('Authorization', `Bearer ${tokenFor(4)}`)
        .expect(201);
      const rows = await database.query<Array<{ status: string }>>(
        'SELECT status FROM coordinations WHERE id = ANY($1::uuid[])',
        [coordinationIds],
      );
      expect(rows).toHaveLength(2);
      expect(rows.every((row) => row.status === 'CANCELLED')).toBe(true);
      const [occurrence] = await database.query<
        Array<{ reserved_seats: number }>
      >(
        `SELECT reserved_seats FROM trip_occurrences
          WHERE driver_trip_id = $1 AND travel_date = $2`,
        [DRIVER_TRIP, date],
      );
      expect(Number(occurrence.reserved_seats)).toBe(0);
    } finally {
      await cleanup(requestIds, date, coordinationIds);
    }
  });
});
