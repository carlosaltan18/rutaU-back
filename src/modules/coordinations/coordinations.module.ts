import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../notifications/entities/notification.entity.js';
import { RideRequest } from '../requests/entities/ride-request.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { TripOccurrence } from '../trips/entities/trip-occurrence.entity.js';
import { CoordinationsController } from './coordinations.controller.js';
import { CoordinationsService } from './coordinations.service.js';
import { Coordination } from './entities/coordination.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Coordination,
      RideRequest,
      TripOccurrence,
      Student,
      Notification,
    ]),
  ],
  controllers: [CoordinationsController],
  providers: [CoordinationsService],
})
export class CoordinationsModule {}
