import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentStudent } from '../../common/auth/current-student.decorator.js';
import { ApiStandardErrors } from '../../common/openapi/api-errors.decorator.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import type { Student } from './entities/student.entity.js';
import { StudentsService } from './students.service.js';

@ApiTags('Student profile')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('me')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtiene el perfil privado propio' })
  getMe(@CurrentStudent() student: Student) {
    return this.service.getMe(student);
  }

  @Patch()
  @ApiOperation({ summary: 'Actualiza el perfil propio' })
  updateMe(@CurrentStudent() student: Student, @Body() input: UpdateMeDto) {
    return this.service.updateMe(student, input);
  }

  @Delete()
  @ApiOperation({ summary: 'Da de baja lógicamente la cuenta propia' })
  deleteMe(@CurrentStudent() student: Student) {
    return this.service.deleteMe(student);
  }
}
