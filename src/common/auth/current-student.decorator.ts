import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Student } from '../../modules/students/entities/student.entity.js';

export const CurrentStudent = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Student =>
    context.switchToHttp().getRequest<{ student: Student }>().student,
);
