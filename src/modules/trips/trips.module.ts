import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campus } from '../catalog/entities/campus.entity.js';
import { Zone } from '../catalog/entities/zone.entity.js';
import { MatchingModule } from '../matching/matching.module.js';
import { TripOccurrence } from './entities/trip-occurrence.entity.js';
import { Trip } from './entities/trip.entity.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';
import { TripCapacityPolicy } from './trip-capacity.policy.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripOccurrence, Zone, Campus]),
    MatchingModule,
  ],
  controllers: [TripsController],
  providers: [TripsService, TripCapacityPolicy],
  exports: [TripsService],
})
export class TripsModule {}
