/**
 * Invariants added before closing sub-step 5.2:
 * - coverageOn rejects an invalid timeline;
 * - modification and archive plans only accept an open version;
 * - evaluated segments expose a value only when a result is decided.
 *
 * The `@ts-expect-error` lines are checked by `npm run typecheck`: each one must be a type error,
 * otherwise the typecheck fails.
 */
import {
  assertLocalDate,
  coverageOn,
  evaluateTimeline,
  planArchive,
  planGoalModification,
  timelineSegments,
  type DecidedPeriod,
  type EvaluatedSegment,
  type GoalVersionSpan,
  type NotEvaluatedSegment,
  type OpenGoalVersion,
  type PendingPeriod,
} from '@/lib/calendar';

const d = assertLocalDate;

const week = (id: string, from: string, to: string | null): GoalVersionSpan => ({
  id,
  period: 'weekly',
  targetValue: 1,
  effectiveFrom: d(from),
  effectiveTo: to === null ? null : d(to),
});

describe('coverageOn validates the timeline', () => {
  it('rejects overlapping versions', () => {
    const versions = [week('a', '2026-11-02', '2026-11-15'), week('b', '2026-11-09', null)];
    expect(() => coverageOn(versions, d('2026-11-10'))).toThrow(RangeError);
  });

  it('rejects versions in the wrong order', () => {
    const versions = [week('b', '2026-11-16', '2026-11-22'), week('a', '2026-11-02', '2026-11-08')];
    expect(() => coverageOn(versions, d('2026-11-03'))).toThrow(RangeError);
  });

  it('rejects an open version that is not the last one', () => {
    const versions = [week('a', '2026-11-02', null), week('b', '2026-11-16', null)];
    expect(() => coverageOn(versions, d('2026-11-03'))).toThrow(RangeError);
  });

  it('rejects a misaligned version', () => {
    expect(() => coverageOn([week('a', '2026-11-04', null)], d('2026-11-05'))).toThrow(RangeError);
  });

  it('still answers for a valid timeline', () => {
    const versions = [week('a', '2026-11-02', '2026-11-08'), week('b', '2026-11-16', null)];
    expect(coverageOn(versions, d('2026-11-08'))).toMatchObject({ kind: 'covered', version: { id: 'a' } });
    expect(coverageOn(versions, d('2026-11-10'))).toEqual({ kind: 'not-evaluated' });
    expect(coverageOn(versions, d('2026-11-16'))).toMatchObject({ kind: 'covered', version: { id: 'b' } });
    expect(coverageOn([], d('2026-11-16'))).toEqual({ kind: 'not-evaluated' });
  });
});

describe('plans only accept an open version', () => {
  const open: OpenGoalVersion = { period: 'weekly', effectiveFrom: d('2026-10-05'), effectiveTo: null };
  const closed = { period: 'weekly', effectiveFrom: d('2026-10-05'), effectiveTo: d('2026-11-08') } as const;

  it('accepts an open version, with unchanged results', () => {
    expect(planGoalModification(open, 'weekly', d('2026-11-05'))).toEqual({
      closeCurrentOn: '2026-11-08',
      newVersionStartsOn: '2026-11-09',
      notEvaluated: null,
    });
    expect(planArchive(open, d('2026-11-05'))).toEqual({ kind: 'close', closeOn: '2026-11-08' });
  });

  it('a closed version is a type error for both plans', () => {
    // @ts-expect-error A closed version is not an OpenGoalVersion.
    expect(() => planGoalModification(closed, 'weekly', d('2026-11-05'))).toThrow('already closed');
    // @ts-expect-error A closed version is not an OpenGoalVersion.
    expect(() => planArchive(closed, d('2026-11-05'))).toThrow('already closed');
  });

  it('a closed version read as untyped data is rejected at run time', () => {
    const fromStorage: unknown = { period: 'monthly', effectiveFrom: '2026-01-01', effectiveTo: '2026-11-30' };
    expect(() => planGoalModification(fromStorage as OpenGoalVersion, 'weekly', d('2026-11-05'))).toThrow(RangeError);
    expect(() => planArchive(fromStorage as OpenGoalVersion, d('2026-11-05'))).toThrow(RangeError);
  });

  it('a version object without effectiveTo is a type error', () => {
    const missing = { period: 'weekly', effectiveFrom: d('2026-10-05') } as const;
    // @ts-expect-error effectiveTo: null is required.
    expect(() => planArchive(missing, d('2026-11-05'))).toThrow('already closed');
  });
});

describe('evaluated segments expose a value only for a decided result', () => {
  // One timeline producing every kind of result, evaluated on Wednesday 18 November 2026.
  const versions: GoalVersionSpan[] = [
    { id: 'v1', period: 'weekly', targetValue: 3, effectiveFrom: d('2026-10-26'), effectiveTo: d('2026-11-08') },
    { id: 'v2', period: 'weekly', targetValue: 3, effectiveFrom: d('2026-11-16'), effectiveTo: null },
  ];
  const activityDays = new Set(['2026-10-26', '2026-10-27', '2026-10-28', '2026-11-02', '2026-11-16']);
  const valueForRange = ({ start, end }: { start: string; end: string }) =>
    [...activityDays].filter((day) => day >= start && day <= end).length;
  const evaluated = evaluateTimeline(
    timelineSegments(versions, { start: d('2026-10-26'), end: d('2026-11-29') }),
    valueForRange,
    d('2026-11-18')
  );

  it('produces each kind of result once, in order', () => {
    expect(evaluated.map((s) => (s.kind === 'period' ? s.outcome : s.kind))).toEqual([
      'achieved',
      'missed',
      'not-evaluated',
      'in-progress',
      'upcoming',
    ]);
  });

  it('achieved and missed carry their computed value', () => {
    const decided = evaluated.filter(
      (s): s is DecidedPeriod => s.kind === 'period' && (s.outcome === 'achieved' || s.outcome === 'missed')
    );
    expect(decided.map((s) => [s.outcome, s.value])).toEqual([
      ['achieved', 3],
      ['missed', 1],
    ]);
  });

  it('in progress and upcoming carry no value', () => {
    const pending = evaluated.filter(
      (s): s is PendingPeriod => s.kind === 'period' && (s.outcome === 'in-progress' || s.outcome === 'upcoming')
    );
    expect(pending).toHaveLength(2);
    for (const s of pending) {
      expect('value' in s).toBe(false);
      expect(s.targetValue).toBe(3);
    }
  });

  it('not evaluated carries no outcome, no target and no value', () => {
    const notEvaluated = evaluated.filter((s): s is NotEvaluatedSegment => s.kind === 'not-evaluated');
    expect(notEvaluated).toEqual([{ kind: 'not-evaluated', start: '2026-11-09', end: '2026-11-15' }]);
    expect(Object.keys(notEvaluated[0]).sort()).toEqual(['end', 'kind', 'start']);
  });

  it('the types forbid every invalid combination', () => {
    const base = { kind: 'period', versionId: 'v', period: 'weekly', targetValue: 1, start: d('2026-11-02'), end: d('2026-11-08') } as const;
    const valid: EvaluatedSegment[] = [
      { ...base, outcome: 'achieved', value: 2 },
      { ...base, outcome: 'missed', value: 0 },
      { ...base, outcome: 'in-progress' },
      { ...base, outcome: 'upcoming' },
      { kind: 'not-evaluated', start: d('2026-11-09'), end: d('2026-11-15') },
    ];
    // @ts-expect-error An achieved period must carry its value.
    const achievedWithoutValue: EvaluatedSegment = { ...base, outcome: 'achieved' };
    // @ts-expect-error A missed period must carry its value.
    const missedWithoutValue: EvaluatedSegment = { ...base, outcome: 'missed' };
    // @ts-expect-error A period in progress exposes no value.
    const inProgressWithValue: EvaluatedSegment = { ...base, outcome: 'in-progress', value: 1 };
    // @ts-expect-error An upcoming period exposes no value.
    const upcomingWithValue: EvaluatedSegment = { ...base, outcome: 'upcoming', value: 0 };
    // @ts-expect-error A not-evaluated interval has no outcome.
    const notEvaluatedWithOutcome: EvaluatedSegment = { kind: 'not-evaluated', start: d('2026-11-09'), end: d('2026-11-15'), outcome: 'missed' };
    // @ts-expect-error A not-evaluated interval has no value.
    const notEvaluatedWithValue: EvaluatedSegment = { kind: 'not-evaluated', start: d('2026-11-09'), end: d('2026-11-15'), value: 0 };
    // @ts-expect-error A not-evaluated interval has no target.
    const notEvaluatedWithTarget: EvaluatedSegment = { kind: 'not-evaluated', start: d('2026-11-09'), end: d('2026-11-15'), targetValue: 3 };
    expect(valid).toHaveLength(5);
    expect([
      achievedWithoutValue,
      missedWithoutValue,
      inProgressWithValue,
      upcomingWithValue,
      notEvaluatedWithOutcome,
      notEvaluatedWithValue,
      notEvaluatedWithTarget,
    ]).toHaveLength(7);
  });

  it('narrowing on the outcome gives a number value without any cast', () => {
    const values: number[] = [];
    for (const s of evaluated) {
      if (s.kind === 'period' && (s.outcome === 'achieved' || s.outcome === 'missed')) values.push(s.value);
    }
    expect(values).toEqual([3, 1]);
  });
});
