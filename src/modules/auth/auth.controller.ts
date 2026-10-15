import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentStudent } from '../../common/auth/current-student.decorator.js';
import { CurrentAuthClaims } from '../../common/auth/current-auth-claims.decorator.js';
import { AllowUnprovisioned } from '../../common/auth/allow-unprovisioned.decorator.js';
import type { AuthClaims } from '../../common/auth/auth-token-verifier.js';
import { ApiStandardErrors } from '../../common/openapi/api-errors.decorator.js';
import type { Student } from '../students/entities/student.entity.js';
import { AuthService } from './auth.service.js';
import { SessionDto } from './dto/session.dto.js';

@ApiTags('Authentication')
@ApiBearerAuth()
@ApiStandardErrors()
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('session')
  @AllowUnprovisioned()
  @Throttle({ default: { limit: 20, ttl: 60 * 1000 } })
  @ApiOperation({ summary: 'Valida la sesión o registra la cuenta inicial' })
  session(
    @CurrentStudent() student: Student | undefined,
    @CurrentAuthClaims() claims: AuthClaims,
    @Body() input: SessionDto,
  ) {
    return this.service.session(student, claims, input);
  }
}
