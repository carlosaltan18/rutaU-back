import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentStudent } from '../../common/auth/current-student.decorator.js';
import { ApiStandardErrors } from '../../common/openapi/api-errors.decorator.js';
import type { Student } from '../students/entities/student.entity.js';
import {
  CreateRideRequestDto,
  RideRequestListQueryDto,
} from './dto/ride-request.dto.js';
import { RequestsService } from './requests.service.js';

@ApiTags('Ride requests')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('ride-requests')
export class RequestsController {
  constructor(private readonly service: RequestsService) {}

  @Post()
  @Throttle({
    default: {
      limit: Number(process.env.RATE_LIMIT_REQUEST_PER_HOUR ?? 60),
      ttl: 60 * 60 * 1000,
    },
  })
  @ApiOperation({
    summary: 'Crea una solicitud o invitación sin consumir cupo',
  })
  create(
    @CurrentStudent() student: Student,
    @Body() input: CreateRideRequestDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.service.create(student, input, idempotencyKey);
  }

  @Get()
  list(
    @CurrentStudent() student: Student,
    @Query() query: RideRequestListQueryDto,
  ) {
    return this.service.list(student, query);
  }

  @Get(':id')
  detail(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(id, student);
  }

  @Post(':id/accept')
  accept(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.accept(id, student);
  }

  @Post(':id/reject')
  reject(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.reject(id, student);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancelPending(id, student);
  }
}
