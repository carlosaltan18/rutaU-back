import type { Student } from './entities/student.entity.js';

export function toPrivateProfile(student: Student) {
  return {
    id: student.id,
    displayName: student.displayName,
    photoUrl: student.photoUrl,
    institutionalEmail: student.institutionalEmail,
    phone: student.phone,
    emailVerified: student.emailVerified,
    universityId: student.universityId,
    campusId: student.campusId,
    accountStatus: student.accountStatus,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

export function toPublicProfile(student: Student) {
  return {
    id: student.id,
    displayName: student.displayName,
    photoUrl: student.photoUrl,
    universityId: student.universityId,
    campusId: student.campusId,
  };
}

export function toAuthorizedContact(student: Student) {
  return { phone: student.phone };
}
