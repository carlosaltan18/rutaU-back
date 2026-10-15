import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentStudent } from '../../common/auth/current-student.decorator.js';
import { ApiStandardErrors } from '../../common/openapi/api-errors.decorator.js';
import type { Student } from '../students/entities/student.entity.js';
import {
  NotificationQueryDto,
  RegisterDeviceDto,
} from './dto/notification.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller()
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get('notifications')
  list(
    @CurrentStudent() student: Student,
    @Query() query: NotificationQueryDto,
  ) {
    return this.service.list(student, query);
  }

  @Post('notifications/:id/read')
  markRead(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.markRead(student, id);
  }

  @Post('devices')
  registerDevice(
    @CurrentStudent() student: Student,
    @Body() input: RegisterDeviceDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.service.registerDevice(student, input, idempotencyKey);
  }

  @Delete('devices/:id')
  deleteDevice(
    @CurrentStudent() student: Student,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteDevice(student, id);
  }
}
