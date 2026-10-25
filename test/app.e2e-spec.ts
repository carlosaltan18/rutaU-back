import 'dotenv/config';
import { type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApplication } from '../src/bootstrap.js';
import { AuthTokenVerifier } from '../src/common/auth/auth-token-verifier.js';
import { LiveLocationService } from '../src/modules/live-location/live-location.service.js';

describe('RutaU API (e2e con PostgreSQL)', () => {
  let app: INestApplication<App>;
  let database: DataSource;
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET,
    signOptions: { issuer: 'rutau-local', expiresIn: '5m' },
  });

  const tokenFor = (subject: string) => jwt.sign({ sub: subject });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuthTokenVerifier)
      .useValue({
        verify: (token: string) => jwt.verifyAsync(token),
      })
      .overrideProvider(LiveLocationService)
      .useValue({
        activateOccurrence: async () => undefined,
        closeOccurrence: async () => undefined,
        removeParticipant: async () => undefined,
        occurrenceId: (driverTripId: string, travelDate: string) =>
          `${driverTripId}_${travelDate}`,
      })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApplication(app);
    await app.init();
    database = app.get(DataSource);
  }, 90_000);

  afterAll(async () => app?.close());

  it('comprueba aplicación y PostgreSQL', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.body.data).toEqual({ status: 'ok', database: 'up' });
  });

  it('rechaza solicitudes sin Bearer token con código estable', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me')
      .expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('resuelve el actor desde sub y devuelve su perfil privado', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${tokenFor('demo-student-1')}`)
      .expect(200);
    expect(response.body.data.displayName).toBe('Pasajero Demo Principal');
    expect(response.body.data.institutionalEmail).toContain(
      '@estudiantes.demo.invalid',
    );
  });

  it('crea una cuenta nueva desde el sub autenticado sin aceptar studentId', async () => {
    const suffix = Date.now();
    const subject = `e2e-new-student-${suffix}`;
    const token = tokenFor(subject);
    try {
      const created = await request(app.getHttpServer())
        .post('/api/v1/auth/session')
        .set('Authorization', `Bearer ${token}`)
        .send({
          displayName: 'Estudiante Nuevo E2E',
          institutionalEmail: `nuevo${suffix}@estudiantes.demo.invalid`,
          universityId: '10000000-0000-4000-8000-000000000001',
          campusId: '20000000-0000-4000-8000-000000000001',
        })
        .expect(201);
      expect(created.body.data.created).toBe(true);
      expect(created.body.data.profile).not.toHaveProperty('authSubject');

      const profile = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(profile.body.data.displayName).toBe('Estudiante Nuevo E2E');
    } finally {
      await database.query('DELETE FROM students WHERE auth_subject = $1', [
        subject,
      ]);
    }
  });

  it('no filtra datos privados en coincidencias y excluye viajes llenos', async () => {
    const today = DateTime.now().setZone('America/Guatemala').startOf('day');
    let days = (1 - today.weekday + 7) % 7;
    if (days === 0) days = 7;
    const date = today.plus({ days }).toISODate();
    const fullTripId = '50000000-0000-4000-8000-000000000002';
    const previous = await database.query<
      Array<{ seat_capacity_snapshot: number; reserved_seats: number }>
    >(
      `SELECT seat_capacity_snapshot, reserved_seats
         FROM trip_occurrences
        WHERE driver_trip_id = $1 AND travel_date = $2`,
      [fullTripId, date],
    );
    await database.query(
      `INSERT INTO trip_occurrences
        (driver_trip_id, travel_date, seat_capacity_snapshot, reserved_seats)
       VALUES ($1, $2, 3, 3)
       ON CONFLICT (driver_trip_id, travel_date)
       DO UPDATE SET seat_capacity_snapshot = 3, reserved_seats = 3`,
      [fullTripId, date],
    );
    try {
      const response = await request(app.getHttpServer())
        .get(
          `/api/v1/trips/50000000-0000-4000-8000-000000000001/matches?travelDate=${date}`,
        )
        .set('Authorization', `Bearer ${tokenFor('demo-student-1')}`)
        .expect(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      for (const match of response.body.data) {
        expect(match.profile).not.toHaveProperty('institutionalEmail');
        expect(match.profile).not.toHaveProperty('phone');
        expect(match.availableSeats).toBeGreaterThan(0);
      }
      expect(
        response.body.data.map(
          (match: { candidateTripId: string }) => match.candidateTripId,
        ),
      ).not.toContain(fullTripId);
    } finally {
      if (previous[0]) {
        await database.query(
          `UPDATE trip_occurrences
              SET seat_capacity_snapshot = $3, reserved_seats = $4
            WHERE driver_trip_id = $1 AND travel_date = $2`,
          [
            fullTripId,
            date,
            previous[0].seat_capacity_snapshot,
            previous[0].reserved_seats,
          ],
        );
      } else {
        await database.query(
          'DELETE FROM trip_occurrences WHERE driver_trip_id = $1 AND travel_date = $2',
          [fullTripId, date],
        );
      }
    }
  });

  it('impide a terceros leer, aceptar o cancelar solicitudes ajenas', async () => {
    const thirdPartyAuth = `Bearer ${tokenFor('demo-student-7')}`;
    const response = await request(app.getHttpServer())
      .get('/api/v1/ride-requests/60000000-0000-4000-8000-000000000010')
      .set('Authorization', thirdPartyAuth)
      .expect(404);
    expect(response.body.error.code).toBe('REQUEST_NOT_FOUND');

    for (const action of ['accept', 'cancel']) {
      const mutation = await request(app.getHttpServer())
        .post(
          `/api/v1/ride-requests/60000000-0000-4000-8000-000000000001/${action}`,
        )
        .set('Authorization', thirdPartyAuth)
        .expect(404);
      expect(mutation.body.error.code).toBe('REQUEST_NOT_FOUND');
    }
  });

  it('muestra contacto solo en coordinación confirmada', async () => {
    const auth = `Bearer ${tokenFor('demo-student-1')}`;
    const pending = await request(app.getHttpServer())
      .get('/api/v1/ride-requests/60000000-0000-4000-8000-000000000001')
      .set('Authorization', auth)
      .expect(200);
    const accepted = await request(app.getHttpServer())
      .get('/api/v1/ride-requests/60000000-0000-4000-8000-000000000010')
      .set('Authorization', auth)
      .expect(200);
    expect(pending.body.data.contact).toBeNull();
    expect(accepted.body.data.contact.phone).toBeTruthy();
  });

  it('Idempotency-Key repite la respuesta y una pendiente no consume cupo', async () => {
    const today = DateTime.now().setZone('America/Guatemala').startOf('day');
    let days = (1 - today.weekday + 7) % 7;
    if (days === 0) days = 7;
    const date = today.plus({ days: days + 21 }).toISODate();
    const auth = `Bearer ${tokenFor('demo-student-7')}`;
    const key = `e2e-pending-${Date.now()}`;
    let requestId: string | undefined;
    try {
      const payload = {
        senderTripId: '50000000-0000-4000-8000-000000000007',
        targetTripId: '50000000-0000-4000-8000-000000000004',
        type: 'JOIN_REQUEST',
        travelDate: date,
        offeredContributionMinor: 925,
        currency: 'GTQ',
        message: 'Prueba E2E pendiente',
      };
      const first = await request(app.getHttpServer())
        .post('/api/v1/ride-requests')
        .set('Authorization', auth)
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201);
      requestId = first.body.data.id;
      const replay = await request(app.getHttpServer())
        .post('/api/v1/ride-requests')
        .set('Authorization', auth)
        .set('Idempotency-Key', key)
        .send(payload)
        .expect(201);
      expect(replay.body.data.id).toBe(requestId);
      const duplicate = await request(app.getHttpServer())
        .post('/api/v1/ride-requests')
        .set('Authorization', auth)
        .send(payload)
        .expect(409);
      expect(duplicate.body.error.code).toBe('REQUEST_ALREADY_EXISTS');
      const [{ count }] = await database.query<Array<{ count: string }>>(
        `SELECT COUNT(*)::text AS count FROM trip_occurrences
          WHERE driver_trip_id = $1 AND travel_date = $2`,
        ['50000000-0000-4000-8000-000000000004', date],
      );
      expect(Number(count)).toBe(0);
    } finally {
      if (requestId) {
        await database.query(
          'DELETE FROM notifications WHERE resource_id = $1',
          [requestId],
        );
        await database.query('DELETE FROM ride_requests WHERE id = $1', [
          requestId,
        ]);
      }
      await database.query('DELETE FROM idempotency_keys WHERE key = $1', [
        key,
      ]);
    }
  });

  it('devuelve conflicto al editar un trayecto con versión obsoleta', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/v1/trips/50000000-0000-4000-8000-000000000001')
      .set('Authorization', `Bearer ${tokenFor('demo-student-1')}`)
      .send({ version: 999 })
      .expect(409);
    expect(response.body.error.code).toBe('TRIP_VERSION_CONFLICT');
  });

  it('publica contrato OpenAPI con solicitudes, invitaciones y coordinaciones', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(response.body.paths['/api/v1/ride-requests']).toBeDefined();
    expect(response.body.paths['/api/v1/coordinations']).toBeDefined();
    expect(
      response.body.components.schemas.CreateRideRequestDto.properties.type
        .enum,
    ).toEqual(['JOIN_REQUEST', 'DRIVER_INVITATION']);
  });
});
