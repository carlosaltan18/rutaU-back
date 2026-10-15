import { TripRole } from '../../common/domain/enums.js';
import { TripCapacityPolicy } from './trip-capacity.policy.js';

describe('TripCapacityPolicy', () => {
  const policy = new TripCapacityPolicy();

  it.each([1, 2, 3])('acepta capacidad de conductor %i', (capacity) => {
    expect(policy.isValid(TripRole.DRIVER, capacity)).toBe(true);
  });

  it.each([0, 4, null])('rechaza capacidad de conductor %s', (capacity) => {
    expect(policy.isValid(TripRole.DRIVER, capacity)).toBe(false);
  });

  it('exige capacidad null para pasajero', () => {
    expect(policy.isValid(TripRole.PASSENGER, null)).toBe(true);
    expect(policy.isValid(TripRole.PASSENGER, 1)).toBe(false);
  });
});
