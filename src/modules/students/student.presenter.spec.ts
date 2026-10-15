import { AccountStatus } from '../../common/domain/enums.js';
import { Student } from './entities/student.entity.js';
import { toAuthorizedContact, toPublicProfile } from './student.presenter.js';

describe('student presenters', () => {
  const student = Object.assign(new Student(), {
    id: 'student',
    authSubject: 'secret-subject',
    displayName: 'Estudiante Demo',
    photoUrl: null,
    institutionalEmail: 'private@example.invalid',
    phone: '+50255555555',
    emailVerified: true,
    universityId: 'university',
    campusId: 'campus',
    accountStatus: AccountStatus.ACTIVE,
  });

  it('el perfil público no incluye correo, teléfono ni authSubject', () => {
    const profile = toPublicProfile(student);
    expect(profile).not.toHaveProperty('institutionalEmail');
    expect(profile).not.toHaveProperty('phone');
    expect(profile).not.toHaveProperty('authSubject');
  });

  it('el contacto autorizado contiene solo teléfono', () => {
    expect(toAuthorizedContact(student)).toEqual({ phone: '+50255555555' });
  });
});
