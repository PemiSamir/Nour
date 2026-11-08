/**
 * Goal periods on calendar dates. Weeks run from Monday to Sunday. Every bound is inclusive.
 */
import {
  addDays,
  daysInMonth,
  isoWeekday,
  localDateFromParts,
  localDateToParts,
  type LocalDate,
} from './local-date';

export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const GOAL_PERIODS: readonly GoalPeriod[] = ['daily', 'weekly', 'monthly', 'yearly'];

export type PeriodRange = {
  readonly period: GoalPeriod;
  /** First day of the period, inclusive. */
  readonly start: LocalDate;
  /** Last day of the period, inclusive. */
  readonly end: LocalDate;
};

function fromParts(year: number, month: number, day: number): LocalDate {
  const date = localDateFromParts({ year, month, day });
  if (date === null) throw new RangeError(`Date out of supported range: ${year}-${month}-${day}`);
  return date;
}

/** First day of the period that contains `date`. */
export function periodStart(period: GoalPeriod, date: LocalDate): LocalDate {
  const { year, month } = localDateToParts(date);
  switch (period) {
    case 'daily':
      return date;
    case 'weekly':
      return addDays(date, 1 - isoWeekday(date));
    case 'monthly':
      return fromParts(year, month, 1);
    case 'yearly':
      return fromParts(year, 1, 1);
  }
}

/** Last day of the period that contains `date`. */
export function periodEnd(period: GoalPeriod, date: LocalDate): LocalDate {
  const { year, month } = localDateToParts(date);
  switch (period) {
    case 'daily':
      return date;
    case 'weekly':
      return addDays(date, 7 - isoWeekday(date));
    case 'monthly':
      return fromParts(year, month, daysInMonth(year, month));
    case 'yearly':
      return fromParts(year, 12, 31);
  }
}

export const startOfDay = (date: LocalDate) => periodStart('daily', date);
export const endOfDay = (date: LocalDate) => periodEnd('daily', date);
export const startOfWeek = (date: LocalDate) => periodStart('weekly', date);
export const endOfWeek = (date: LocalDate) => periodEnd('weekly', date);
export const startOfMonth = (date: LocalDate) => periodStart('monthly', date);
export const endOfMonth = (date: LocalDate) => periodEnd('monthly', date);
export const startOfYear = (date: LocalDate) => periodStart('yearly', date);
export const endOfYear = (date: LocalDate) => periodEnd('yearly', date);

/** The period of this kind that contains `date`. */
export function periodContaining(period: GoalPeriod, date: LocalDate): PeriodRange {
  return { period, start: periodStart(period, date), end: periodEnd(period, date) };
}

/** The period of the same kind that immediately follows `range`. */
export function nextPeriod(range: PeriodRange): PeriodRange {
  return periodContaining(range.period, addDays(range.end, 1));
}

/** The period of the same kind that immediately precedes `range`. */
export function previousPeriod(range: PeriodRange): PeriodRange {
  return periodContaining(range.period, addDays(range.start, -1));
}

export function isPeriodStart(period: GoalPeriod, date: LocalDate): boolean {
  return periodStart(period, date) === date;
}

export function isPeriodEnd(period: GoalPeriod, date: LocalDate): boolean {
  return periodEnd(period, date) === date;
}

/** First start of a period of this kind strictly after `date`. */
export function firstPeriodStartAfter(period: GoalPeriod, date: LocalDate): LocalDate {
  return addDays(periodEnd(period, date), 1);
}

export function isWithinPeriod(range: PeriodRange, date: LocalDate): boolean {
  return date >= range.start && date <= range.end;
}
