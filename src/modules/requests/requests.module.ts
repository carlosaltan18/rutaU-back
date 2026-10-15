import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Coordination } from '../coordinations/entities/coordination.entity.js';
import { MatchingModule } from '../matching/matching.module.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { TripOccurrence } from '../trips/entities/trip-occurrence.entity.js';
import { Trip } from '../trips/entities/trip.entity.js';
import { RideRequest } from './entities/ride-request.entity.js';
import { RequestsController } from './requests.controller.js';
import { RequestStatePolicy } from './request-state.policy.js';
import { RequestsService } from './requests.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RideRequest,
      Trip,
      TripOccurrence,
      Student,
      Coordination,
      Notification,
    ]),
    MatchingModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService, RequestStatePolicy],
  exports: [RequestsService, RequestStatePolicy],
})
export class RequestsModule {}
