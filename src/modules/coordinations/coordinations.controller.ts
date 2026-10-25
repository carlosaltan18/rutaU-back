import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentStudent } from '../../common/auth/current-student.decorator.js';
import { ApiStandardErrors } from '../../common/openapi/api-errors.decorator.js';
import type { Student } from '../students/entities/student.entity.js';
import { CoordinationsService } from './coordinations.service.js';
import { CoordinationQueryDto } from './dto/coordination-query.dto.js';

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
