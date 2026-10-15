import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentStudent } from '../../common/auth/current-student.decorator.js';
import { ApiStandardErrors } from '../../common/openapi/api-errors.decorator.js';
import { MatchingService } from '../matching/matching.service.js';
import type { Student } from '../students/entities/student.entity.js';
import {
  CreateTripDto,
  MatchQueryDto,
  TripListQueryDto,
  UpdateTripDto,
} from './dto/trip.dto.js';
import { TripsService } from './trips.service.js';

@ApiTags('Trips')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('trips')
export class TripsController {
  constructor(
    private readonly trips: TripsService,
    private readonly matching: MatchingService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crea un trayecto habitual propio' })
  create(
    @CurrentStudent() student: Student,
    @Body() input: CreateTripDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.trips.create(student, input, idempotencyKey);
  }

  @Get()
  list(@CurrentStudent() student: Student, @Query() query: TripListQueryDto) {
    return this.trips.list(student, query);
  }

  @Get(':sourceTripId/matches/:candidateTripId')
  getCandidate(
    @CurrentStudent() student: Student,
    @Param('sourceTripId', ParseUUIDPipe) sourceTripId: string,
    @Param('candidateTripId', ParseUUIDPipe) candidateTripId: string,
  ) {
    return this.matching.getAuthorizedCandidate(
      student,
      sourceTripId,
      candidateTripId,
    );
  }

  @Get(':id/matches')
  @Throttle({
    default: {
      limit: Number(process.env.RATE_LIMIT_SEARCH_PER_MINUTE ?? 30),
      ttl: 60 * 1000,
    },
  })
  findMatches(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: MatchQueryDto,
  ) {
    return this.matching.findMatches(student, id, query);
  }

  @Get(':id')
  get(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trips.get(student, id);
  }

  @Patch(':id')
  update(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateTripDto,
  ) {
    return this.trips.update(student, id, input);
  }

  @Post(':id/deactivate')
  deactivate(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trips.deactivate(student, id);
  }

  @Delete(':id')
  delete(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trips.delete(student, id);
  }
}
