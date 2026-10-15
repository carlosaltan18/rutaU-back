import { DateTime } from 'luxon';

export const BUSINESS_TIME_ZONE = 'America/Guatemala';

export function timeToMinutes(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(':').map(Number);
  return hour * 60 + minute;
}

export function timeDifferenceMinutes(a: string, b: string): number {
  return Math.abs(timeToMinutes(a) - timeToMinutes(b));
}

export function localDeparture(travelDate: string, time: string): DateTime {
  return DateTime.fromISO(`${travelDate}T${time.slice(0, 5)}`, {
    zone: BUSINESS_TIME_ZONE,
  });
}

export function isFutureDeparture(
  travelDate: string,
  time: string,
  now = DateTime.now(),
): boolean {
  return localDeparture(travelDate, time).toUTC() > now.toUTC();
}

export function isoWeekday(travelDate: string): number {
  return DateTime.fromISO(travelDate, { zone: BUSINESS_TIME_ZONE }).weekday;
}
