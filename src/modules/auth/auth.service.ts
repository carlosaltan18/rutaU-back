import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthClaims } from '../../common/auth/auth-token-verifier.js';
import { AccountStatus } from '../../common/domain/enums.js';
import { DomainException } from '../../common/errors/domain.exception.js';
import { Campus } from '../catalog/entities/campus.entity.js';
import { UniversityEmailDomain } from '../catalog/entities/university.entity.js';
import { Student } from '../students/entities/student.entity.js';
import { toPrivateProfile } from '../students/student.presenter.js';
import type { SessionDto } from './dto/session.dto.js';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Student) private readonly students: Repository<Student>,
    @InjectRepository(Campus) private readonly campuses: Repository<Campus>,
    @InjectRepository(UniversityEmailDomain)
    private readonly domains: Repository<UniversityEmailDomain>,
  ) {}

  async session(
    student: Student | undefined,
    claims: AuthClaims,
    input: SessionDto,
  ) {
    if (student) {
      return {
        authenticated: true,
        created: false,
        profile: toPrivateProfile(student),
      };
    }

    const required = [
      ['displayName', input.displayName],
      ['institutionalEmail', input.institutionalEmail],
      ['universityId', input.universityId],
      ['campusId', input.campusId],
    ].filter(([, value]) => !value);
    if (required.length) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Faltan datos para crear la cuenta.',
        HttpStatus.BAD_REQUEST,
        required.map(([field]) => ({
          field: String(field),
          message: 'Este campo es obligatorio para crear la cuenta.',
        })),
      );
    }

    const campus = await this.campuses.findOneBy({
      id: input.campusId!,
      universityId: input.universityId!,
      active: true,
    });
    if (!campus) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'El campus no pertenece a la universidad indicada.',
        HttpStatus.BAD_REQUEST,
      );
    }
    const email = input.institutionalEmail!.toLowerCase();
    const domain = email.split('@')[1];
    if (domain) {
      const existing = await this.domains.findOneBy({
        universityId: input.universityId!,
        domain,
      });
      if (!existing) {
        await this.domains
          .save(
            this.domains.create({
              universityId: input.universityId!,
              domain,
              active: true,
            }),
          )
          .catch(() => null);
      }
    }

    try {
      const created = await this.students.save(
        this.students.create({
          authSubject: claims.sub,
          displayName: input.displayName!,
          institutionalEmail: email,
          photoUrl: input.photoUrl ?? null,
          phone: input.phone ?? null,
          emailVerified:
            claims.emailVerified === true &&
            claims.email?.toLowerCase() === email,
          universityId: input.universityId!,
          campusId: input.campusId!,
          accountStatus: AccountStatus.ACTIVE,
        }),
      );
      return {
        authenticated: true,
        created: true,
        profile: toPrivateProfile(created),
      };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === '23505'
      ) {
        throw new DomainException(
          'VALIDATION_ERROR',
          'La identidad o el correo institucional ya están registrados.',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }
}
