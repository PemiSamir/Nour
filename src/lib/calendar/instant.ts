/**
 * The only place where an instant is turned into a calendar date.
 *
 * An instant is a number of milliseconds since 1970-01-01T00:00:00Z. Its local date depends on the
 * UTC offset in force at that instant, which is stored with every activity. With an explicit offset
 * the result never depends on the device time zone, and matches the SQLite expression
 * `date(instant / 1000 + utc_offset_min * 60, 'unixepoch')` used by the database constraints.
 */
import { fromDayNumber, type LocalDate } from './local-date';

/** Minutes to add to UTC to get local time: +60 for Paris in winter, +120 in summer. */
export type UtcOffsetMinutes = number;

export type LocalDateTime = {
  readonly date: LocalDate;
  /** Minutes since local midnight, from 0 to 1439. */
  readonly minutesOfDay: number;
};

export const MIN_UTC_OFFSET_MINUTES = -720;
export const MAX_UTC_OFFSET_MINUTES = 840;

const MILLISECONDS_PER_MINUTE = 60_000;
const MINUTES_PER_DAY = 1_440;

/** Same rule as the database: from UTC-12:00 to UTC+14:00, in steps of 15 minutes. */
export function isValidUtcOffset(offset: number): boolean {
  return (
    Number.isInteger(offset) &&
    offset >= MIN_UTC_OFFSET_MINUTES &&
    offset <= MAX_UTC_OFFSET_MINUTES &&
    offset % 15 === 0
  );
}

export function assertUtcOffset(offset: number): UtcOffsetMinutes {
  if (!isValidUtcOffset(offset)) throw new RangeError(`Invalid UTC offset in minutes: ${offset}`);
  return offset;
}

/** Local date and time of day for an instant, given the UTC offset in force at that instant. */
export function localDateTimeFromInstant(epochMilliseconds: number, utcOffset: UtcOffsetMinutes): LocalDateTime {
  if (!Number.isInteger(epochMilliseconds)) {
    throw new RangeError(`Instant must be an integer number of milliseconds: ${epochMilliseconds}`);
  }
  assertUtcOffset(utcOffset);
  const localMinutes = Math.floor(epochMilliseconds / MILLISECONDS_PER_MINUTE) + utcOffset;
  const dayNumber = Math.floor(localMinutes / MINUTES_PER_DAY);
  return {
    date: fromDayNumber(dayNumber),
    minutesOfDay: localMinutes - dayNumber * MINUTES_PER_DAY,
  };
}

export function localDateFromInstant(epochMilliseconds: number, utcOffset: UtcOffsetMinutes): LocalDate {
  return localDateTimeFromInstant(epochMilliseconds, utcOffset).date;
}

/**
 * UTC offset of the device at this `Date`, following the database convention.
 * JavaScript's `getTimezoneOffset` has the opposite sign: -60 for Paris in winter.
 */
export function utcOffsetMinutesOf(date: Date): UtcOffsetMinutes {
  const offset = -date.getTimezoneOffset();
  return offset === 0 ? 0 : offset; // avoids -0
}
