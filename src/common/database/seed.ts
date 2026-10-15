import 'dotenv/config';
import { DateTime } from 'luxon';
import dataSource from './data-source.js';
import {
  AccountStatus,
  CoordinationStatus,
  RequestStatus,
  RequestType,
  TripRole,
  TripStatus,
} from '../domain/enums.js';
import { Campus } from '../../modules/catalog/entities/campus.entity.js';
import {
  University,
  UniversityEmailDomain,
} from '../../modules/catalog/entities/university.entity.js';
import { Zone } from '../../modules/catalog/entities/zone.entity.js';
import { Coordination } from '../../modules/coordinations/entities/coordination.entity.js';
import { RideRequest } from '../../modules/requests/entities/ride-request.entity.js';
import { Student } from '../../modules/students/entities/student.entity.js';
import { TripOccurrence } from '../../modules/trips/entities/trip-occurrence.entity.js';
import { Trip } from '../../modules/trips/entities/trip.entity.js';

const ids = {
  university: '10000000-0000-4000-8000-000000000001',
  campus: '20000000-0000-4000-8000-000000000001',
  zone: '30000000-0000-4000-8000-000000000001',
  students: Array.from(
    { length: 8 },
    (_, i) => `40000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  ),
  trips: Array.from(
    { length: 10 },
    (_, i) => `50000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  ),
};

function nextIsoWeekday(weekday: number, weeksAhead = 0): string {
  const today = DateTime.now().setZone('America/Guatemala').startOf('day');
  let days = (weekday - today.weekday + 7) % 7;
  if (days === 0) days = 7;
  return today.plus({ days: days + weeksAhead * 7 }).toISODate()!;
}

function pairKey(a: string, b: string) {
  return [a, b].sort().join(':');
}

async function seed() {
  await dataSource.initialize();
  await dataSource.transaction(async (manager) => {
    await manager
      .getRepository(University)
      .upsert(
        { id: ids.university, name: 'Universidad Demo RutaU', active: true },
        ['id'],
      );
    await manager.getRepository(UniversityEmailDomain).upsert(
      {
        id: '11000000-0000-4000-8000-000000000001',
        universityId: ids.university,
        domain: 'estudiantes.demo.invalid',
        active: true,
      },
      ['id'],
    );
    await manager.getRepository(Campus).upsert(
      {
        id: ids.campus,
        universityId: ids.university,
        name: 'Campus Central Demo',
        active: true,
      },
      ['id'],
    );
    await manager.getRepository(Zone).upsert(
      {
        id: ids.zone,
        name: 'Zona Demo Norte',
        municipality: 'Guatemala Demo',
        department: 'Guatemala',
        active: true,
      },
      ['id'],
    );

    const names = [
      'Pasajero Demo Principal',
      'Conductor Demo 00',
      'Conductor Demo 15',
      'Conductor Demo 30',
      'Pasajero Demo Dos',
      'Pasajero Demo Tres',
      'Pasajero Demo Cuatro',
      'Conductor Demo Martes',
    ];
    await manager.getRepository(Student).upsert(
      names.map((displayName, index) => ({
        id: ids.students[index],
        authSubject: `demo-student-${index + 1}`,
        displayName,
        photoUrl: null,
        institutionalEmail: `demo${index + 1}@estudiantes.demo.invalid`,
        phone: `+50255550${String(index + 1).padStart(3, '0')}`,
        emailVerified: true,
        universityId: ids.university,
        campusId: ids.campus,
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
      })),
      ['id'],
    );

    const common = {
      originZoneId: ids.zone,
      destinationCampusId: ids.campus,
      dayOfWeek: 1,
      status: TripStatus.ACTIVE,
      version: 1,
      deletedAt: null,
    };
    await manager.getRepository(Trip).upsert(
      [
        {
          ...common,
          id: ids.trips[0],
          studentId: ids.students[0],
          departureTime: '06:30',
          role: TripRole.PASSENGER,
          seatCapacity: null,
        },
        ...[0, 15, 30].map((minutes, index) => ({
          ...common,
          id: ids.trips[index + 1],
          studentId: ids.students[index + 1],
          departureTime: `0${6 + Math.floor((30 + minutes) / 60)}:${String(
            (30 + minutes) % 60,
          ).padStart(2, '0')}`.slice(-5),
          role: TripRole.DRIVER,
          seatCapacity: 3,
        })),
        ...[4, 5, 6].map((studentIndex, index) => ({
          ...common,
          id: ids.trips[studentIndex],
          studentId: ids.students[studentIndex],
          departureTime: `06:${String(30 + index * 10).padStart(2, '0')}`,
          role: TripRole.PASSENGER,
          seatCapacity: null,
        })),
        {
          ...common,
          id: ids.trips[7],
          studentId: ids.students[7],
          dayOfWeek: 2,
          departureTime: '07:00',
          role: TripRole.DRIVER,
          seatCapacity: 3,
        },
        ...[4, 5].map((studentIndex, index) => ({
          ...common,
          id: ids.trips[index + 8],
          studentId: ids.students[studentIndex],
          dayOfWeek: 2,
          departureTime: index === 0 ? '07:00' : '07:15',
          role: TripRole.PASSENGER,
          seatCapacity: null,
        })),
      ],
      ['id'],
    );

    const monday = nextIsoWeekday(1);
    const nextMonday = nextIsoWeekday(1, 1);
    const tuesday = nextIsoWeekday(2);
    const expiredDate = DateTime.now()
      .setZone('America/Guatemala')
      .minus({ weeks: 1 })
      .startOf('week')
      .toISODate()!;
    const requestRepository = manager.getRepository(RideRequest);
    const coordinationRepository = manager.getRepository(Coordination);

    const accepted: Array<{
      requestId: string;
      coordinationId: string;
      passengerTripId: string;
      driverTripId: string;
      date: string;
    }> = [
      ...[ids.trips[0], ids.trips[4], ids.trips[5]].map(
        (passengerTripId, index) => ({
          requestId: `60000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
          coordinationId: `70000000-0000-4000-8000-${String(index + 10).padStart(12, '0')}`,
          passengerTripId,
          driverTripId: ids.trips[1],
          date: monday,
        }),
      ),
      ...[ids.trips[8], ids.trips[9]].map((passengerTripId, index) => ({
        requestId: `60000000-0000-4000-8000-${String(index + 20).padStart(12, '0')}`,
        coordinationId: `70000000-0000-4000-8000-${String(index + 20).padStart(12, '0')}`,
        passengerTripId,
        driverTripId: ids.trips[7],
        date: tuesday,
      })),
    ];
    const tripById = new Map(
      (await manager.getRepository(Trip).find()).map((trip) => [trip.id, trip]),
    );
    for (const item of accepted) {
      const passenger = tripById.get(item.passengerTripId)!;
      const driver = tripById.get(item.driverTripId)!;
      await requestRepository.upsert(
        {
          id: item.requestId,
          type: RequestType.JOIN_REQUEST,
          senderTripId: passenger.id,
          targetTripId: driver.id,
          driverTripId: driver.id,
          passengerTripId: passenger.id,
          travelDate: item.date,
          requestedSeats: 1,
          offeredContributionMinor: '1000',
          currency: 'GTQ',
          message: 'Solicitud ficticia de demostración',
          status: RequestStatus.ACCEPTED,
          pairKey: pairKey(passenger.id, driver.id),
          respondedAt: new Date(),
          cancelledAt: null,
          expiredAt: null,
        },
        ['id'],
      );
      await coordinationRepository.upsert(
        {
          id: item.coordinationId,
          rideRequestId: item.requestId,
          driverStudentId: driver.studentId,
          passengerStudentId: passenger.studentId,
          driverTripId: driver.id,
          passengerTripId: passenger.id,
          travelDate: item.date,
          plannedDepartureTime: driver.departureTime,
          originZoneId: driver.originZoneId,
          destinationCampusId: driver.destinationCampusId,
          agreedContributionMinor: '1000',
          currency: 'GTQ',
          status: CoordinationStatus.CONFIRMED,
          cancelledAt: null,
          completedAt: null,
        },
        ['id'],
      );
    }

    await manager.getRepository(TripOccurrence).upsert(
      [
        {
          driverTripId: ids.trips[1],
          travelDate: monday,
          seatCapacitySnapshot: 3,
          reservedSeats: 3,
        },
        {
          driverTripId: ids.trips[7],
          travelDate: tuesday,
          seatCapacitySnapshot: 3,
          reservedSeats: 2,
        },
      ],
      ['driverTripId', 'travelDate'],
    );

    const terminalRequests = [
      {
        id: '60000000-0000-4000-8000-000000000001',
        status: RequestStatus.PENDING,
        passengerTripId: ids.trips[0],
        driverTripId: ids.trips[3],
        date: nextMonday,
      },
      {
        id: '60000000-0000-4000-8000-000000000002',
        status: RequestStatus.REJECTED,
        passengerTripId: ids.trips[0],
        driverTripId: ids.trips[2],
        date: nextMonday,
      },
      {
        id: '60000000-0000-4000-8000-000000000003',
        status: RequestStatus.CANCELLED,
        passengerTripId: ids.trips[4],
        driverTripId: ids.trips[2],
        date: nextMonday,
      },
      {
        id: '60000000-0000-4000-8000-000000000004',
        status: RequestStatus.EXPIRED,
        passengerTripId: ids.trips[0],
        driverTripId: ids.trips[3],
        date: expiredDate,
      },
    ];
    for (const item of terminalRequests) {
      await requestRepository.upsert(
        {
          id: item.id,
          type: RequestType.JOIN_REQUEST,
          senderTripId: item.passengerTripId,
          targetTripId: item.driverTripId,
          driverTripId: item.driverTripId,
          passengerTripId: item.passengerTripId,
          travelDate: item.date,
          requestedSeats: 1,
          offeredContributionMinor: '750',
          currency: 'GTQ',
          message: 'Estado ficticio de demostración',
          status: item.status,
          pairKey: pairKey(item.passengerTripId, item.driverTripId),
          respondedAt:
            item.status === RequestStatus.REJECTED ? new Date() : null,
          cancelledAt:
            item.status === RequestStatus.CANCELLED ? new Date() : null,
          expiredAt: item.status === RequestStatus.EXPIRED ? new Date() : null,
        },
        ['id'],
      );
    }
  });
  await dataSource.destroy();
  console.log('Datos ficticios de RutaU creados.');
  console.log('Sujetos JWT: demo-student-1 ... demo-student-8');
}

await seed().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  if (dataSource.isInitialized) await dataSource.destroy();
  process.exitCode = 1;
});
