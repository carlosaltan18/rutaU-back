import { DateTime } from 'luxon';
import { isFutureDeparture, localDeparture } from './business-time.js';

describe('business time America/Guatemala', () => {
  it('convierte la salida local a su instante UTC correcto', () => {
    expect(localDeparture('2026-10-12', '06:30').toUTC().toISO()).toBe(
      '2026-10-12T12:30:00.000Z',
    );
  });

  it('expira al alcanzar la hora local de salida', () => {
    expect(
      isFutureDeparture(
        '2026-10-12',
        '06:30',
        DateTime.fromISO('2026-10-12T12:29:59Z'),
      ),
    ).toBe(true);
    expect(
      isFutureDeparture(
        '2026-10-12',
        '06:30',
        DateTime.fromISO('2026-10-12T12:30:00Z'),
      ),
    ).toBe(false);
  });
});
