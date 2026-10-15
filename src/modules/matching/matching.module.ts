import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../students/entities/student.entity.js';
import { TripOccurrence } from '../trips/entities/trip-occurrence.entity.js';
import { Trip } from '../trips/entities/trip.entity.js';
import { CompatibilityPolicy } from './compatibility.policy.js';
import { MatchingService } from './matching.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, TripOccurrence, Student])],
  providers: [CompatibilityPolicy, MatchingService],
  exports: [CompatibilityPolicy, MatchingService],
})
export class MatchingModule {}
