import 'dotenv/config';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.config.js';
import { InitialSchema1760328000000 } from './migrations/1760328000000-initial-schema.js';
import { AddPushDelivery1792890000000 } from './migrations/1792890000000-add-push-delivery.js';
import { AddLiveTripLifecycle1792891000000 } from './migrations/1792891000000-add-live-trip-lifecycle.js';
import { AddCoordinationMeetingPoint1792892000000 } from './migrations/1792892000000-add-coordination-meeting-point.js';
import { AddCoordinationMeetingCoordinates1792893000000 } from './migrations/1792893000000-add-coordination-meeting-coordinates.js';

const options = databaseOptions();

export default new DataSource({
  ...options,
  migrations: [
    InitialSchema1760328000000,
    AddPushDelivery1792890000000,
    AddLiveTripLifecycle1792891000000,
    AddCoordinationMeetingPoint1792892000000,
    AddCoordinationMeetingCoordinates1792893000000,
  ],
} as ConstructorParameters<typeof DataSource>[0]);
