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

    const email = (
      input.institutionalEmail || claims.email
    )?.trim().toLowerCase();
    if (!email) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'Se requiere un correo electrónico para crear la cuenta.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const displayName = (
      input.displayName ||
      claims.name ||
      email.split('@')[0]
    )?.trim();

    let universityId = input.universityId;
    let campusId = input.campusId;

    if (!universityId || !campusId) {
      const defaultCampus = await this.campuses.findOne({
        where: { active: true },
        order: { createdAt: 'ASC' },
      });
      if (defaultCampus) {
        universityId = defaultCampus.universityId;
        campusId = defaultCampus.id;
      }
    } else {
      const campus = await this.campuses.findOneBy({
        id: campusId,
        universityId: universityId,
        active: true,
      });
      if (!campus) {
        throw new DomainException(
          'VALIDATION_ERROR',
          'El campus no pertenece a la universidad indicada.',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    if (!universityId || !campusId) {
      throw new DomainException(
        'VALIDATION_ERROR',
        'No hay campus disponibles configurados en el sistema.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const domain = email.split('@')[1];
    if (domain) {
      const existing = await this.domains.findOneBy({
        universityId,
        domain,
      });
      if (!existing) {
        await this.domains
          .save(
            this.domains.create({
              universityId,
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
          displayName: displayName || 'Estudiante RutaU',
          institutionalEmail: email,
          photoUrl: input.photoUrl ?? claims.picture ?? null,
          phone: input.phone ?? null,
          emailVerified:
            claims.emailVerified === true &&
            claims.email?.toLowerCase() === email,
          universityId,
          campusId,
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
