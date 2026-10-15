import { IdempotencyKey } from '../idempotency/idempotency-key.entity.js';
import { Campus } from '../../modules/catalog/entities/campus.entity.js';
import {
  University,
  UniversityEmailDomain,
} from '../../modules/catalog/entities/university.entity.js';
import { Zone } from '../../modules/catalog/entities/zone.entity.js';
import { Coordination } from '../../modules/coordinations/entities/coordination.entity.js';
import {
  DeviceToken,
  Notification,
} from '../../modules/notifications/entities/notification.entity.js';
import { RideRequest } from '../../modules/requests/entities/ride-request.entity.js';
import { Student } from '../../modules/students/entities/student.entity.js';
import { TripOccurrence } from '../../modules/trips/entities/trip-occurrence.entity.js';
import { Trip } from '../../modules/trips/entities/trip.entity.js';

export const DATABASE_ENTITIES = [
  University,
  UniversityEmailDomain,
  Campus,
  Zone,
  Student,
  Trip,
  TripOccurrence,
  RideRequest,
  Coordination,
  Notification,
  DeviceToken,
  IdempotencyKey,
];
