/**
 * Dates of goal versions, following the validated rules:
 * - a new goal starts with the current period, so activities already done in it count;
 * - a change takes effect at the next period: the current version closes at the end of its
 *   current period and the new version starts at the first period start after that;
 * - archiving closes the open version at the end of its current period, or removes it if it has
 *   not started yet;
 * - reactivation starts at max(start of the current period, first period start after the end of
 *   the last version), both computed with the period of the new version.
 *
 * Versions are never reopened and never moved: these functions only compute dates.
 *
 * Each version stays aligned on the calendar bounds of its own periodicity. When the periodicity
 * changes, the days between the end of the old version and the start of the new one are left
 * not evaluated, as validated: no partial period is created to fill them.
 */
import { type DateRange, uncoveredBetween } from './goal-timeline';
import { maxLocalDate, type LocalDate } from './local-date';
import { firstPeriodStartAfter, periodEnd, periodStart, type GoalPeriod } from './periods';

/**
 * The open version of a goal. `effectiveTo: null` makes the compiler reject a closed version, which
 * could otherwise be closed a second time.
 */
export type OpenGoalVersion = {
  readonly period: GoalPeriod;
  readonly effectiveFrom: LocalDate;
  readonly effectiveTo: null;
};

function assertOpen(version: OpenGoalVersion): void {
  // Also guards callers that bypass the type, for example with data read as `any`.
  if (version.effectiveTo !== null) throw new RangeError('The version is already closed');
}

/** First day of a new goal's first version. */
export function startDateForNewGoal(period: GoalPeriod, today: LocalDate): LocalDate {
  return periodStart(period, today);
}

export type ModificationPlan = {
  /** Last day of the current version. */
  readonly closeCurrentOn: LocalDate;
  /** First day of the new version. */
  readonly newVersionStartsOn: LocalDate;
  /** Days left without any version between the two, or `null` if the versions are contiguous. */
  readonly notEvaluated: DateRange | null;
};

/**
 * Plans a change of target or period for a version that has already started.
 * A version that has not started yet is replaced instead, which is not handled here.
 */
export function planGoalModification(
  current: OpenGoalVersion,
  newPeriod: GoalPeriod,
  today: LocalDate
): ModificationPlan {
  assertOpen(current);
  if (current.effectiveFrom > today) {
    throw new RangeError('The current version has not started yet: replace it instead of modifying it');
  }
  const closeCurrentOn = periodEnd(current.period, today);
  const newVersionStartsOn = firstPeriodStartAfter(newPeriod, closeCurrentOn);
  return {
    closeCurrentOn,
    newVersionStartsOn,
    notEvaluated: uncoveredBetween(closeCurrentOn, newVersionStartsOn),
  };
}

export type ArchivePlan =
  | { readonly kind: 'close'; readonly closeOn: LocalDate }
  | { readonly kind: 'remove-unstarted' };

/** What archiving does to the open version. */
export function planArchive(openVersion: OpenGoalVersion, today: LocalDate): ArchivePlan {
  assertOpen(openVersion);
  if (openVersion.effectiveFrom > today) return { kind: 'remove-unstarted' };
  return { kind: 'close', closeOn: periodEnd(openVersion.period, today) };
}

/** First day of the new version created when an archived goal is reactivated. */
export function startDateForReactivation(
  newPeriod: GoalPeriod,
  today: LocalDate,
  lastVersionEnd: LocalDate
): LocalDate {
  return maxLocalDate(periodStart(newPeriod, today), firstPeriodStartAfter(newPeriod, lastVersionEnd));
}
