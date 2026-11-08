/**
 * Timeline of a goal: which dates are evaluated by which version, and which are not evaluated.
 *
 * Validated rules:
 * - every version covers whole periods aligned on the calendar bounds of its own periodicity;
 * - no partial period is ever created to fill a gap;
 * - dates between two versions, before the first one or after an archived goal's last one, are
 *   not evaluated: they are neither achieved nor missed, and carry no value, target or score.
 */
import { addDays, type LocalDate } from './local-date';
import { isPeriodEnd, isPeriodStart, periodContaining, type GoalPeriod } from './periods';

export type DateRange = {
  /** First day, inclusive. */
  readonly start: LocalDate;
  /** Last day, inclusive. */
  readonly end: LocalDate;
};

/** A goal version as stored, reduced to what the calendar needs. */
export type GoalVersionSpan = {
  readonly id: string;
  readonly period: GoalPeriod;
  readonly targetValue: number;
  readonly effectiveFrom: LocalDate;
  /** Last day covered, or `null` for the open version. */
  readonly effectiveTo: LocalDate | null;
};

/**
 * Checks the same invariants as the database: versions sorted by start date, aligned on their
 * period bounds, never overlapping, and only the last one may be open.
 */
export function assertValidTimeline(versions: readonly GoalVersionSpan[]): void {
  versions.forEach((version, index) => {
    const { id, period, targetValue, effectiveFrom, effectiveTo } = version;
    if (!Number.isInteger(targetValue) || targetValue <= 0) {
      throw new RangeError(`Version ${id}: target must be a positive integer`);
    }
    if (!isPeriodStart(period, effectiveFrom)) {
      throw new RangeError(`Version ${id}: ${effectiveFrom} is not the start of a ${period} period`);
    }
    if (effectiveTo !== null) {
      if (effectiveTo < effectiveFrom) throw new RangeError(`Version ${id}: ends before it starts`);
      if (!isPeriodEnd(period, effectiveTo)) {
        throw new RangeError(`Version ${id}: ${effectiveTo} is not the end of a ${period} period`);
      }
    } else if (index !== versions.length - 1) {
      throw new RangeError(`Version ${id}: only the last version can be open`);
    }
    const previous = versions[index - 1];
    if (previous !== undefined && (previous.effectiveTo === null || effectiveFrom <= previous.effectiveTo)) {
      throw new RangeError(`Version ${id}: must start after the end of version ${previous.id}`);
    }
  });
}

/** Days strictly between the end of one version and the start of the next, or `null` if none. */
export function uncoveredBetween(previousEnd: LocalDate, nextStart: LocalDate): DateRange | null {
  const start = addDays(previousEnd, 1);
  const end = addDays(nextStart, -1);
  return start <= end ? { start, end } : null;
}

export type DateCoverage =
  | { readonly kind: 'covered'; readonly version: GoalVersionSpan }
  | { readonly kind: 'not-evaluated' };

function coverageInValidTimeline(versions: readonly GoalVersionSpan[], date: LocalDate): DateCoverage {
  const version = versions.find(
    (v) => v.effectiveFrom <= date && (v.effectiveTo === null || date <= v.effectiveTo)
  );
  return version ? { kind: 'covered', version } : { kind: 'not-evaluated' };
}

/**
 * Which version evaluates this date, if any. The timeline is validated first, so a date can never
 * be attached to an arbitrary version of an overlapping or unsorted list.
 */
export function coverageOn(versions: readonly GoalVersionSpan[], date: LocalDate): DateCoverage {
  assertValidTimeline(versions);
  return coverageInValidTimeline(versions, date);
}

export type TimelineSegment =
  | {
      readonly kind: 'period';
      readonly versionId: string;
      readonly period: GoalPeriod;
      readonly targetValue: number;
      readonly start: LocalDate;
      readonly end: LocalDate;
    }
  | { readonly kind: 'not-evaluated'; readonly start: LocalDate; readonly end: LocalDate };

/**
 * Splits `range` into whole periods of the covering versions and not-evaluated intervals, in
 * chronological order. A period that only partly overlaps `range` is returned whole; a
 * not-evaluated interval is clipped to `range`.
 */
export function timelineSegments(versions: readonly GoalVersionSpan[], range: DateRange): TimelineSegment[] {
  assertValidTimeline(versions);
  if (range.end < range.start) throw new RangeError('The range ends before it starts');

  const segments: TimelineSegment[] = [];
  let cursor = range.start;
  while (cursor <= range.end) {
    const coverage = coverageInValidTimeline(versions, cursor);
    if (coverage.kind === 'covered') {
      const { id, period, targetValue } = coverage.version;
      const { start, end } = periodContaining(period, cursor);
      segments.push({ kind: 'period', versionId: id, period, targetValue, start, end });
      cursor = addDays(end, 1);
    } else {
      const nextStart = versions.find((v) => v.effectiveFrom > cursor)?.effectiveFrom;
      const gapEnd = nextStart !== undefined && addDays(nextStart, -1) < range.end ? addDays(nextStart, -1) : range.end;
      segments.push({ kind: 'not-evaluated', start: cursor, end: gapEnd });
      cursor = addDays(gapEnd, 1);
    }
  }
  return segments;
}

export type PeriodOutcome = 'achieved' | 'missed' | 'in-progress' | 'upcoming';

type EvaluatedPeriodBase = {
  readonly kind: 'period';
  readonly versionId: string;
  readonly period: GoalPeriod;
  readonly targetValue: number;
  readonly start: LocalDate;
  readonly end: LocalDate;
};

/** A period with a result: its computed value is always present. */
export type DecidedPeriod = EvaluatedPeriodBase & {
  readonly outcome: 'achieved' | 'missed';
  readonly value: number;
};

/** A period without a result yet: no computed value is exposed. */
export type PendingPeriod = EvaluatedPeriodBase & {
  readonly outcome: 'in-progress' | 'upcoming';
  readonly value?: never;
};

/** Not evaluated: no outcome, no target and no value, by construction. */
export type NotEvaluatedSegment = {
  readonly kind: 'not-evaluated';
  readonly start: LocalDate;
  readonly end: LocalDate;
  readonly outcome?: never;
  readonly targetValue?: never;
  readonly value?: never;
};

export type EvaluatedSegment = DecidedPeriod | PendingPeriod | NotEvaluatedSegment;

/**
 * Evaluates each period with the value of its activities.
 * - `valueForRange` is never called for a not-evaluated interval or an upcoming period.
 * - A period that has not ended is in progress, unless its target is already reached: it is then
 *   achieved early. The value of an in-progress period is computed only to detect that, and is
 *   not exposed.
 */
export function evaluateTimeline(
  segments: readonly TimelineSegment[],
  valueForRange: (range: DateRange) => number,
  today: LocalDate
): EvaluatedSegment[] {
  return segments.map((segment): EvaluatedSegment => {
    if (segment.kind === 'not-evaluated') {
      return { kind: 'not-evaluated', start: segment.start, end: segment.end };
    }
    const { versionId, period, targetValue, start, end } = segment;
    const base: EvaluatedPeriodBase = { kind: 'period', versionId, period, targetValue, start, end };
    if (start > today) return { ...base, outcome: 'upcoming' };
    const value = valueForRange({ start, end });
    if (value >= targetValue) return { ...base, outcome: 'achieved', value };
    if (end >= today) return { ...base, outcome: 'in-progress' };
    return { ...base, outcome: 'missed', value };
  });
}

export type TimelineSummary = {
  readonly achieved: number;
  readonly missed: number;
  readonly inProgress: number;
  readonly upcoming: number;
  /** Informative only: never counted as achieved or missed. */
  readonly notEvaluatedDays: number;
  /** Achieved among achieved and missed periods, or `null` when no period has been decided. */
  readonly achievementRate: number | null;
};

export function summarizeTimeline(evaluated: readonly EvaluatedSegment[]): TimelineSummary {
  let achieved = 0;
  let missed = 0;
  let inProgress = 0;
  let upcoming = 0;
  let notEvaluatedDays = 0;
  for (const segment of evaluated) {
    if (segment.kind === 'not-evaluated') {
      let day = segment.start;
      while (day <= segment.end) {
        notEvaluatedDays++;
        day = addDays(day, 1);
      }
      continue;
    }
    if (segment.outcome === 'achieved') achieved++;
    else if (segment.outcome === 'missed') missed++;
    else if (segment.outcome === 'in-progress') inProgress++;
    else upcoming++;
  }
  const decided = achieved + missed;
  return {
    achieved,
    missed,
    inProgress,
    upcoming,
    notEvaluatedDays,
    achievementRate: decided === 0 ? null : achieved / decided,
  };
}
