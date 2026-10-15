import { TripRole } from '../../common/domain/enums.js';
import {
  CompatibilityPolicy,
  type CompatibleTrip,
} from './compatibility.policy.js';

const base: CompatibleTrip = {
  id: 'source',
  studentId: 'student-a',
  originZoneId: 'zone-a',
  destinationCampusId: 'campus-a',
  dayOfWeek: 1,
  departureTime: '06:30',
  role: TripRole.PASSENGER,
};

function candidate(overrides: Partial<CompatibleTrip> = {}): CompatibleTrip {
  return {
    ...base,
    id: 'candidate',
    studentId: 'student-b',
    departureTime: '07:00',
    role: TripRole.DRIVER,
    ...overrides,
  };
}

describe('CompatibilityPolicy', () => {
  const policy = new CompatibilityPolicy();

  it('acepta una diferencia exacta de 30 minutos', () => {
    expect(policy.evaluate(base, candidate(), 1).compatible).toBe(true);
  });

  it('rechaza una diferencia de 31 minutos', () => {
    expect(
      policy.evaluate(base, candidate({ departureTime: '07:01' }), 1)
        .compatible,
    ).toBe(false);
  });

  it.each([
    { originZoneId: 'other-zone' },
    { destinationCampusId: 'other-campus' },
    { dayOfWeek: 2 },
  ])('rechaza zona, campus o día diferente: %o', (change) => {
    expect(policy.evaluate(base, candidate(change), 1).compatible).toBe(false);
  });

  it('se autoexcluye', () => {
    expect(
      policy.evaluate(base, candidate({ studentId: base.studentId }), 1)
        .compatible,
    ).toBe(false);
  });

  it('rechaza roles iguales', () => {
    expect(
      policy.evaluate(base, candidate({ role: TripRole.PASSENGER }), 1)
        .compatible,
    ).toBe(false);
  });

  it('rechaza conductor sin plazas', () => {
    expect(policy.evaluate(base, candidate(), 0).compatible).toBe(false);
  });
});
