import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentStudent } from '../../common/auth/current-student.decorator.js';
import { ApiStandardErrors } from '../../common/openapi/api-errors.decorator.js';
import type { Student } from '../students/entities/student.entity.js';
import { CoordinationsService } from './coordinations.service.js';
import { CoordinationQueryDto } from './dto/coordination-query.dto.js';
import { UpdateMeetingPointDto } from './dto/meeting-point.dto.js';

@ApiTags('Coordinations')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller()
export class CoordinationsController {
  constructor(private readonly service: CoordinationsService) {}

  @Get('coordinations')
  list(
    @CurrentStudent() student: Student,
    @Query() query: CoordinationQueryDto,
  ) {
    return this.service.list(student, query);
  }

  @Get('coordinations/:id')
  detail(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.detail(id, student);
  }

  @Get('ride-requests/:id/coordination')
  byRequest(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.byRequest(id, student);
  }

  @Post('coordinations/:id/cancel')
  cancel(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.cancel(id, student);
  }

  @Patch('coordinations/:id/meeting-point')
  @ApiOperation({ summary: 'Propone o actualiza el punto de encuentro' })
  updateMeetingPoint(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateMeetingPointDto,
  ) {
    return this.service.updateMeetingPoint(id, student, input);
  }

  @Post('coordinations/:id/meeting-point/confirm')
  @ApiOperation({ summary: 'Confirma el punto de encuentro actual' })
  confirmMeetingPoint(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.confirmMeetingPoint(id, student);
  }

  @Post('coordinations/:id/live-location/start')
  @ApiOperation({
    summary: 'Inicia la ubicación en vivo; disponible solo para el conductor',
  })
  startLiveLocation(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.startLiveLocation(id, student);
  }

  @Post('coordinations/:id/live-location/end')
  @ApiOperation({
    summary: 'Finaliza el viaje y elimina la ubicación en vivo',
  })
  endLiveLocation(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.endLiveLocation(id, student);
  }
}
