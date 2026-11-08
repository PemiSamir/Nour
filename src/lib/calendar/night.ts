/**
 * Night attribution for night prayers.
 *
 * A night is named after the evening it begins. A prayer before the cutoff, 06:00 by default,
 * belongs to the previous night; from the cutoff on, it belongs to the current date's night.
 * This matches the database constraint
 * `night_date IS date(started_at / 1000 + utc_offset_min * 60 - cutoff_min * 60, 'unixepoch')`.
 */
import { localDateTimeFromInstant, type UtcOffsetMinutes } from './instant';
import { addDays, type LocalDate } from './local-date';

/** 06:00, in minutes after midnight. */
export const DEFAULT_NIGHT_CUTOFF_MINUTES = 360;

/** Same bounds as the database: from 00:00 to 12:00. */
export const MAX_NIGHT_CUTOFF_MINUTES = 720;

export function assertNightCutoff(cutoffMinutes: number): number {
  if (!Number.isInteger(cutoffMinutes) || cutoffMinutes < 0 || cutoffMinutes > MAX_NIGHT_CUTOFF_MINUTES) {
    throw new RangeError(`Invalid night cutoff in minutes: ${cutoffMinutes}`);
  }
  return cutoffMinutes;
}

/** Night of a prayer made on `date` at `minutesOfDay` local time. */
export function nightDateFor(
  date: LocalDate,
  minutesOfDay: number,
  cutoffMinutes: number = DEFAULT_NIGHT_CUTOFF_MINUTES
): LocalDate {
  if (!Number.isInteger(minutesOfDay) || minutesOfDay < 0 || minutesOfDay >= 1440) {
    throw new RangeError(`Invalid minutes of day: ${minutesOfDay}`);
  }
  assertNightCutoff(cutoffMinutes);
  return minutesOfDay < cutoffMinutes ? addDays(date, -1) : date;
}

/** Night of a prayer that started at this instant, with the UTC offset in force at that instant. */
export function nightDateFromInstant(
  epochMilliseconds: number,
  utcOffset: UtcOffsetMinutes,
  cutoffMinutes: number = DEFAULT_NIGHT_CUTOFF_MINUTES
): LocalDate {
  const { date, minutesOfDay } = localDateTimeFromInstant(epochMilliseconds, utcOffset);
  return nightDateFor(date, minutesOfDay, cutoffMinutes);
}
