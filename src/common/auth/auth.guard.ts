import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountStatus } from '../domain/enums.js';
import { DomainException } from '../errors/domain.exception.js';
import { Student } from '../../modules/students/entities/student.entity.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { AuthTokenVerifier, type AuthClaims } from './auth-token-verifier.js';
import { ALLOW_UNPROVISIONED_KEY } from './allow-unprovisioned.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenVerifier: AuthTokenVerifier,
    @InjectRepository(Student)
    private readonly students: Repository<Student>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      student?: Student;
      authClaims?: AuthClaims;
    }>();
    const authorization = request.headers.authorization;
    const raw = Array.isArray(authorization) ? authorization[0] : authorization;
    const token = raw?.startsWith('Bearer ') ? raw.slice(7).trim() : null;
    if (!token) throw this.unauthenticated();

    let claims: AuthClaims;
    try {
      claims = await this.tokenVerifier.verify(token);
    } catch {
      throw this.unauthenticated();
    }
    if (!claims.sub) throw this.unauthenticated();
    request.authClaims = claims;

    const student = await this.students.findOne({
      where: { authSubject: claims.sub },
      withDeleted: true,
    });
    if (!student) {
      const allowUnprovisioned = this.reflector.getAllAndOverride<boolean>(
        ALLOW_UNPROVISIONED_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (allowUnprovisioned) return true;
      throw new DomainException(
        'FORBIDDEN',
        'La cuenta todavía no está registrada.',
        HttpStatus.FORBIDDEN,
      );
    }
    if (student.accountStatus !== AccountStatus.ACTIVE || student.deletedAt) {
      throw new DomainException(
        'FORBIDDEN',
        'La cuenta no está activa.',
        HttpStatus.FORBIDDEN,
      );
    }
    request.student = student;
    return true;
  }

  private unauthenticated() {
    return new DomainException(
      'UNAUTHENTICATED',
      'El token es ausente o inválido.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
