/**
 * Calendar dates without time or time zone.
 *
 * A `LocalDate` is a validated `YYYY-MM-DD` string. Every business rule of NOUR works on these
 * calendar dates. Arithmetic uses an integer day number, never milliseconds and never `Date`, so
 * daylight saving time changes cannot shift a result.
 *
 * Never build a `LocalDate` with `new Date('YYYY-MM-DD')`: that string is read as UTC midnight and
 * gives the previous day in time zones behind UTC. Use `parseLocalDate` or `localDateFromParts`.
 */

declare const localDateBrand: unique symbol;

/** A validated calendar date in the `YYYY-MM-DD` format. */
export type LocalDate = string & { readonly [localDateBrand]: true };

export type LocalDateParts = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

/** ISO day of the week: 1 is Monday, 7 is Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const MIN_YEAR = 1;
const MAX_YEAR = 9999;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Invalid month: ${month}`);
  }
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function isValidParts(year: number, month: number, day: number): boolean {
  return (
    Number.isInteger(year) &&
    Number.isInteger(month) &&
    Number.isInteger(day) &&
    year >= MIN_YEAR &&
    year <= MAX_YEAR &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

const pad = (value: number, length: number) => String(value).padStart(length, '0');

/** Returns the date for these parts, or `null` if they do not form a real calendar date. */
export function localDateFromParts(parts: LocalDateParts): LocalDate | null {
  const { year, month, day } = parts;
  if (!isValidParts(year, month, day)) return null;
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as LocalDate;
}

/** Parses a strict `YYYY-MM-DD` string. Returns `null` for any other format or impossible date. */
export function parseLocalDate(value: string): LocalDate | null {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) return null;
  return localDateFromParts({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  });
}

export function isLocalDate(value: string): value is LocalDate {
  return parseLocalDate(value) !== null;
}

/** Like `parseLocalDate`, but throws a `RangeError` for an invalid value. */
export function assertLocalDate(value: string): LocalDate {
  const date = parseLocalDate(value);
  if (date === null) throw new RangeError(`Invalid local date: ${JSON.stringify(value)}`);
  return date;
}

export function localDateToParts(date: LocalDate): LocalDateParts {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

/**
 * Number of days since 1970-01-01 for a proleptic Gregorian date.
 * Algorithm "days_from_civil" by Howard Hinnant, exact for every year.
 */
export function dayNumberFromParts(parts: LocalDateParts): number {
  const { month, day } = parts;
  const year = month <= 2 ? parts.year - 1 : parts.year;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const monthFromMarch = (month + 9) % 12;
  const dayOfYear = Math.floor((153 * monthFromMarch + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

/** Inverse of `dayNumberFromParts`. Algorithm "civil_from_days" by Howard Hinnant. */
export function partsFromDayNumber(dayNumber: number): LocalDateParts {
  if (!Number.isInteger(dayNumber)) throw new RangeError(`Invalid day number: ${dayNumber}`);
  const shifted = dayNumber + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365
  );
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthFromMarch = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthFromMarch + 2) / 5) + 1;
  const month = monthFromMarch < 10 ? monthFromMarch + 3 : monthFromMarch - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

export function toDayNumber(date: LocalDate): number {
  return dayNumberFromParts(localDateToParts(date));
}

export function fromDayNumber(dayNumber: number): LocalDate {
  const date = localDateFromParts(partsFromDayNumber(dayNumber));
  if (date === null) throw new RangeError(`Day number out of supported range: ${dayNumber}`);
  return date;
}

/** Negative if `a` is before `b`, zero if equal, positive if after. */
export function compareLocalDates(a: LocalDate, b: LocalDate): -1 | 0 | 1 {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export const isBefore = (a: LocalDate, b: LocalDate) => a < b;
export const isAfter = (a: LocalDate, b: LocalDate) => a > b;
export const minLocalDate = (a: LocalDate, b: LocalDate) => (a <= b ? a : b);
export const maxLocalDate = (a: LocalDate, b: LocalDate) => (a >= b ? a : b);

export function addDays(date: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days)) throw new RangeError(`Days must be an integer: ${days}`);
  return fromDayNumber(toDayNumber(date) + days);
}

export const subtractDays = (date: LocalDate, days: number) => addDays(date, -days);

/** Number of calendar days from `from` to `to`; negative if `to` is earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function isoWeekday(date: LocalDate): IsoWeekday {
  // 1970-01-01 was a Thursday (ISO 4).
  const mondayBased = (((toDayNumber(date) + 3) % 7) + 7) % 7;
  return (mondayBased + 1) as IsoWeekday;
}

/**
 * Calendar date shown by the device for this `Date`, read from its local fields.
 * Use it only to get "today" from the current clock, never to parse a stored date.
 */
export function localDateFromDate(date: Date): LocalDate {
  const result = localDateFromParts({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });
  if (result === null) throw new RangeError('Invalid Date');
  return result;
}

export function todayLocalDate(now: Date = new Date()): LocalDate {
  return localDateFromDate(now);
}
