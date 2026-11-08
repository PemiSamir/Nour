import {
  assertLocalDate,
  isPeriodEnd,
  isPeriodStart,
  planArchive,
  planGoalModification,
  startDateForNewGoal,
  startDateForReactivation,
  type GoalPeriod,
} from '@/lib/calendar';

const d = assertLocalDate;

describe('new goal: starts with the current period', () => {
  it.each([
    ['daily', '2026-11-05', '2026-11-05'],
    ['weekly', '2026-11-05', '2026-11-02'],
    ['monthly', '2026-11-05', '2026-11-01'],
    ['yearly', '2026-11-05', '2026-01-01'],
    ['weekly', '2027-01-01', '2026-12-28'],
  ] as const)('%s goal created on %s starts on %s', (period, today, expected) => {
    expect(startDateForNewGoal(period, d(today))).toBe(expected);
  });
});

describe('modification: takes effect at the next period', () => {
  it.each([
    ['weekly', '2026-10-05', 'weekly', '2026-11-05', '2026-11-08', '2026-11-09', null],
    ['weekly', '2026-10-05', 'monthly', '2026-11-05', '2026-11-08', '2026-12-01', { start: '2026-11-09', end: '2026-11-30' }],
    ['monthly', '2026-01-01', 'weekly', '2026-11-05', '2026-11-30', '2026-12-07', { start: '2026-12-01', end: '2026-12-06' }],
    ['monthly', '2026-01-01', 'daily', '2026-11-05', '2026-11-30', '2026-12-01', null],
    ['daily', '2026-11-01', 'daily', '2026-11-05', '2026-11-05', '2026-11-06', null],
    ['yearly', '2026-01-01', 'monthly', '2026-11-05', '2026-12-31', '2027-01-01', null],
    ['monthly', '2028-01-01', 'monthly', '2028-02-10', '2028-02-29', '2028-03-01', null],
  ] as const)(
    '%s version since %s changed to %s on %s: closes %s, new version from %s, not evaluated %j',
    (period, effectiveFrom, newPeriod, today, close, start, notEvaluated) => {
      const plan = planGoalModification({ period, effectiveFrom: d(effectiveFrom), effectiveTo: null }, newPeriod, d(today));
      expect(plan).toEqual({ closeCurrentOn: close, newVersionStartsOn: start, notEvaluated });
      expect(isPeriodEnd(period, plan.closeCurrentOn)).toBe(true);
      expect(isPeriodStart(newPeriod, plan.newVersionStartsOn)).toBe(true);
      expect(plan.newVersionStartsOn > plan.closeCurrentOn).toBe(true);
    }
  );

  it('monthly to weekly: 30 November is a Monday but still covered, so the new week starts on 7 December', () => {
    const plan = planGoalModification({ period: 'monthly', effectiveFrom: d('2026-01-01'), effectiveTo: null }, 'weekly', d('2026-11-05'));
    expect(plan).toEqual({
      closeCurrentOn: '2026-11-30',
      newVersionStartsOn: '2026-12-07',
      notEvaluated: { start: '2026-12-01', end: '2026-12-06' },
    });
  });

  it('refuses to modify a version that has not started yet', () => {
    expect(() => planGoalModification({ period: 'weekly', effectiveFrom: d('2026-11-09'), effectiveTo: null }, 'weekly', d('2026-11-05'))).toThrow(
      RangeError
    );
  });
});

describe('archive', () => {
  it('closes a started version at the end of its current period', () => {
    expect(planArchive({ period: 'weekly', effectiveFrom: d('2026-10-05'), effectiveTo: null }, d('2026-11-05'))).toEqual({
      kind: 'close',
      closeOn: '2026-11-08',
    });
    expect(planArchive({ period: 'monthly', effectiveFrom: d('2028-01-01'), effectiveTo: null }, d('2028-02-10'))).toEqual({
      kind: 'close',
      closeOn: '2028-02-29',
    });
  });

  it('removes a version that has not started yet', () => {
    expect(planArchive({ period: 'weekly', effectiveFrom: d('2026-11-09'), effectiveTo: null }, d('2026-11-05'))).toEqual({
      kind: 'remove-unstarted',
    });
  });

  it('a version starting today has started', () => {
    expect(planArchive({ period: 'daily', effectiveFrom: d('2026-11-05'), effectiveTo: null }, d('2026-11-05')).kind).toBe('close');
  });
});

describe('reactivation: max(start of current period, first period start after the last version)', () => {
  const cases: ReadonlyArray<readonly [string, GoalPeriod, string, string, string]> = [
    ['weekly closed this Sunday, reactivated monthly the same day', 'monthly', '2026-11-08', '2026-11-08', '2026-12-01'],
    ['weekly closed a month ago, reactivated monthly', 'monthly', '2026-11-08', '2026-10-11', '2026-11-01'],
    ['monthly closed end of October, reactivated weekly', 'weekly', '2026-11-08', '2026-10-31', '2026-11-02'],
    ['monthly closed end of November, reactivated daily on the 8th', 'daily', '2026-11-08', '2026-11-30', '2026-12-01'],
    ['weekly closed this Sunday, reactivated weekly the same day', 'weekly', '2026-11-08', '2026-11-08', '2026-11-09'],
    ['daily closed yesterday, reactivated yearly', 'yearly', '2026-11-08', '2026-11-07', '2027-01-01'],
    ['yearly closed end of 2025, reactivated yearly', 'yearly', '2026-11-08', '2025-12-31', '2026-01-01'],
    ['weekly closed Sunday 1 March, reactivated monthly on 2 March', 'monthly', '2026-03-02', '2026-03-01', '2026-04-01'],
    ['daily closed 28 February 2028, reactivated daily', 'daily', '2028-02-28', '2028-02-28', '2028-02-29'],
    ['weekly closed long ago, reactivated weekly mid-week', 'weekly', '2026-11-05', '2026-10-11', '2026-11-02'],
    ['monthly closed 31 January 2028, reactivated monthly in February', 'monthly', '2028-02-15', '2028-01-31', '2028-02-01'],
  ];

  it.each(cases)('%s', (_label, period, today, lastEnd, expected) => {
    const start = startDateForReactivation(period, d(today), d(lastEnd));
    expect(start).toBe(expected);
    expect(isPeriodStart(period, start)).toBe(true);
    expect(start > lastEnd).toBe(true);
  });
});
