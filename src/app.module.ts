import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthGuard } from './common/auth/auth.guard.js';
import { databaseOptions } from './common/database/database.config.js';
import { FirebaseModule } from './common/firebase/firebase.module.js';
import { IdempotencyModule } from './common/idempotency/idempotency.module.js';
import { validateEnvironment } from './common/config/validate-env.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { CoordinationsModule } from './modules/coordinations/coordinations.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MatchingModule } from './modules/matching/matching.module.js';
import { LiveLocationModule } from './modules/live-location/live-location.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { RequestsModule } from './modules/requests/requests.module.js';
import { StudentsModule } from './modules/students/students.module.js';
import { TripsModule } from './modules/trips/trips.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({ useFactory: databaseOptions }),
    FirebaseModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    IdempotencyModule,
    AuthModule,
    HealthModule,
    CatalogModule,
    StudentsModule,
    LiveLocationModule,
    MatchingModule,
    TripsModule,
    RequestsModule,
    CoordinationsModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
