import {
  addDays,
  assertLocalDate,
  assertValidTimeline,
  coverageOn,
  evaluateTimeline,
  planArchive,
  planGoalModification,
  startDateForReactivation,
  summarizeTimeline,
  timelineSegments,
  uncoveredBetween,
  type DateRange,
  type GoalVersionSpan,
  type LocalDate,
} from '@/lib/calendar';

const d = assertLocalDate;

function eachDay(range: DateRange): LocalDate[] {
  const days: LocalDate[] = [];
  for (let day = range.start; day <= range.end; day = addDays(day, 1)) days.push(day);
  return days;
}

const overlaps = (a: DateRange, b: DateRange) => a.start <= b.end && b.start <= a.end;

/** Builds `valueForRange` from a value per day and records every range it is asked for. */
function activityValues(valueOf: (day: LocalDate) => number) {
  const requested: DateRange[] = [];
  const valueForRange = (range: DateRange) => {
    requested.push(range);
    return eachDay(range).reduce((sum, day) => sum + valueOf(day), 0);
  };
  return { valueForRange, requested };
}

describe('weekly to monthly: 9 to 30 November 2026 is not evaluated', () => {
  const plan = planGoalModification({ period: 'weekly', effectiveFrom: d('2026-10-05'), effectiveTo: null }, 'monthly', d('2026-11-05'));
  const versions: GoalVersionSpan[] = [
    { id: 'v1', period: 'weekly', targetValue: 5, effectiveFrom: d('2026-10-05'), effectiveTo: plan.closeCurrentOn },
    { id: 'v2', period: 'monthly', targetValue: 25, effectiveFrom: plan.newVersionStartsOn, effectiveTo: null },
  ];
  const gap = { start: d('2026-11-09'), end: d('2026-11-30') };

  it('the modification plan reports the interval', () => {
    expect(plan).toEqual({ closeCurrentOn: '2026-11-08', newVersionStartsOn: '2026-12-01', notEvaluated: gap });
    expect(() => assertValidTimeline(versions)).not.toThrow();
  });

  it('no date of the interval belongs to a version', () => {
    const days = eachDay(gap);
    expect(days).toHaveLength(22);
    for (const day of days) expect(coverageOn(versions, day)).toEqual({ kind: 'not-evaluated' });
  });

  it('dates before and after the interval stay with their own version', () => {
    const versionOf = (day: string) => {
      const coverage = coverageOn(versions, d(day));
      return coverage.kind === 'covered' ? coverage.version.id : 'none';
    };
    expect(versionOf('2026-10-05')).toBe('v1');
    expect(versionOf('2026-11-02')).toBe('v1');
    expect(versionOf('2026-11-08')).toBe('v1');
    expect(versionOf('2026-11-09')).toBe('none');
    expect(versionOf('2026-11-30')).toBe('none');
    expect(versionOf('2026-12-01')).toBe('v2');
    expect(versionOf('2026-12-31')).toBe('v2');
    expect(versionOf('2026-10-04')).toBe('none');
  });

  it('splits the timeline into whole weeks, the interval, then whole months', () => {
    expect(timelineSegments(versions, { start: d('2026-10-05'), end: d('2026-12-31') })).toEqual([
      { kind: 'period', versionId: 'v1', period: 'weekly', targetValue: 5, start: '2026-10-05', end: '2026-10-11' },
      { kind: 'period', versionId: 'v1', period: 'weekly', targetValue: 5, start: '2026-10-12', end: '2026-10-18' },
      { kind: 'period', versionId: 'v1', period: 'weekly', targetValue: 5, start: '2026-10-19', end: '2026-10-25' },
      { kind: 'period', versionId: 'v1', period: 'weekly', targetValue: 5, start: '2026-10-26', end: '2026-11-01' },
      { kind: 'period', versionId: 'v1', period: 'weekly', targetValue: 5, start: '2026-11-02', end: '2026-11-08' },
      { kind: 'not-evaluated', start: '2026-11-09', end: '2026-11-30' },
      { kind: 'period', versionId: 'v2', period: 'monthly', targetValue: 25, start: '2026-12-01', end: '2026-12-31' },
    ]);
  });

  it('the interval is never evaluated, has no value, target or outcome, and is never read', () => {
    const { valueForRange, requested } = activityValues(() => 1);
    const segments = timelineSegments(versions, { start: d('2026-10-05'), end: d('2026-12-31') });
    const evaluated = evaluateTimeline(segments, valueForRange, d('2027-01-10'));

    const notEvaluated = evaluated.filter((s) => s.kind === 'not-evaluated');
    expect(notEvaluated).toEqual([{ kind: 'not-evaluated', start: '2026-11-09', end: '2026-11-30' }]);
    expect(Object.keys(notEvaluated[0]).sort()).toEqual(['end', 'kind', 'start']);
    expect(requested.some((range) => overlaps(range, gap))).toBe(false);

    expect(summarizeTimeline(evaluated)).toEqual({
      achieved: 6,
      missed: 0,
      inProgress: 0,
      upcoming: 0,
      notEvaluatedDays: 22,
      achievementRate: 1,
    });
  });

  it('activities done during the interval change no outcome', () => {
    const segments = timelineSegments(versions, { start: d('2026-10-05'), end: d('2026-12-31') });
    const inGapOnly = activityValues((day) => (day >= gap.start && day <= gap.end ? 100 : 0));
    const none = activityValues(() => 0);
    const withGapActivity = evaluateTimeline(segments, inGapOnly.valueForRange, d('2027-01-10'));
    const withoutActivity = evaluateTimeline(segments, none.valueForRange, d('2027-01-10'));

    expect(withGapActivity).toEqual(withoutActivity);
    expect(summarizeTimeline(withGapActivity)).toEqual({
      achieved: 0,
      missed: 6,
      inProgress: 0,
      upcoming: 0,
      notEvaluatedDays: 22,
      achievementRate: 0,
    });
  });
});

describe('monthly to weekly: 1 to 6 December 2026 is not evaluated', () => {
  const plan = planGoalModification({ period: 'monthly', effectiveFrom: d('2026-01-01'), effectiveTo: null }, 'weekly', d('2026-11-05'));
  const versions: GoalVersionSpan[] = [
    { id: 'v1', period: 'monthly', targetValue: 20, effectiveFrom: d('2026-01-01'), effectiveTo: plan.closeCurrentOn },
    { id: 'v2', period: 'weekly', targetValue: 5, effectiveFrom: plan.newVersionStartsOn, effectiveTo: null },
  ];
  const gap = { start: d('2026-12-01'), end: d('2026-12-06') };

  it('the modification plan reports the interval', () => {
    expect(plan).toEqual({ closeCurrentOn: '2026-11-30', newVersionStartsOn: '2026-12-07', notEvaluated: gap });
  });

  it('no date of the interval belongs to a version, and the bounds stay attached', () => {
    for (const day of eachDay(gap)) expect(coverageOn(versions, day).kind).toBe('not-evaluated');
    const at = (day: string) => coverageOn(versions, d(day));
    expect(at('2026-11-30')).toMatchObject({ kind: 'covered', version: { id: 'v1' } });
    expect(at('2026-11-01')).toMatchObject({ kind: 'covered', version: { id: 'v1' } });
    expect(at('2026-12-07')).toMatchObject({ kind: 'covered', version: { id: 'v2' } });
    expect(at('2026-12-13')).toMatchObject({ kind: 'covered', version: { id: 'v2' } });
  });

  it('evaluates November, skips the interval, then evaluates whole weeks', () => {
    const { valueForRange, requested } = activityValues((day) => (day >= gap.start && day <= gap.end ? 50 : 1));
    const segments = timelineSegments(versions, { start: d('2026-11-01'), end: d('2026-12-20') });
    const evaluated = evaluateTimeline(segments, valueForRange, d('2026-12-16'));

    expect(evaluated).toEqual([
      { kind: 'period', versionId: 'v1', period: 'monthly', targetValue: 20, start: '2026-11-01', end: '2026-11-30', value: 30, outcome: 'achieved' },
      { kind: 'not-evaluated', start: '2026-12-01', end: '2026-12-06' },
      { kind: 'period', versionId: 'v2', period: 'weekly', targetValue: 5, start: '2026-12-07', end: '2026-12-13', value: 7, outcome: 'achieved' },
      { kind: 'period', versionId: 'v2', period: 'weekly', targetValue: 5, start: '2026-12-14', end: '2026-12-20', value: 7, outcome: 'achieved' },
    ]);
    expect(requested.some((range) => overlaps(range, gap))).toBe(false);
    expect(summarizeTimeline(evaluated).notEvaluatedDays).toBe(6);
  });

  it('a week not finished yet is in progress, not missed', () => {
    const { valueForRange } = activityValues(() => 0);
    const segments = timelineSegments(versions, { start: d('2026-12-14'), end: d('2026-12-16') });
    expect(evaluateTimeline(segments, valueForRange, d('2026-12-16'))).toEqual([
      { kind: 'period', versionId: 'v2', period: 'weekly', targetValue: 5, start: '2026-12-14', end: '2026-12-20', outcome: 'in-progress' },
    ]);
  });
});

describe('archive and reactivation leave the paused days not evaluated', () => {
  it('weekly archived on 8 November and reactivated monthly the same day', () => {
    const archive = planArchive({ period: 'weekly', effectiveFrom: d('2026-10-05'), effectiveTo: null }, d('2026-11-08'));
    expect(archive).toEqual({ kind: 'close', closeOn: '2026-11-08' });
    const start = startDateForReactivation('monthly', d('2026-11-08'), d('2026-11-08'));
    expect(start).toBe('2026-12-01');
    expect(uncoveredBetween(d('2026-11-08'), start)).toEqual({ start: '2026-11-09', end: '2026-11-30' });
  });

  it('a long pause is one not-evaluated interval, reactivated from the current week', () => {
    const start = startDateForReactivation('weekly', d('2026-11-05'), d('2026-10-11'));
    const versions: GoalVersionSpan[] = [
      { id: 'v1', period: 'weekly', targetValue: 3, effectiveFrom: d('2026-09-28'), effectiveTo: d('2026-10-11') },
      { id: 'v2', period: 'weekly', targetValue: 3, effectiveFrom: start, effectiveTo: null },
    ];
    expect(timelineSegments(versions, { start: d('2026-09-28'), end: d('2026-11-05') }).map((s) => [s.kind, s.start, s.end])).toEqual([
      ['period', '2026-09-28', '2026-10-04'],
      ['period', '2026-10-05', '2026-10-11'],
      ['not-evaluated', '2026-10-12', '2026-11-01'],
      ['period', '2026-11-02', '2026-11-08'],
    ]);
  });

  it('after an archived goal, the remaining days are not evaluated', () => {
    const versions: GoalVersionSpan[] = [
      { id: 'v1', period: 'daily', targetValue: 1, effectiveFrom: d('2026-11-01'), effectiveTo: d('2026-11-03') },
    ];
    const segments = timelineSegments(versions, { start: d('2026-10-30'), end: d('2026-11-06') });
    expect(segments.map((s) => [s.kind, s.start, s.end])).toEqual([
      ['not-evaluated', '2026-10-30', '2026-10-31'],
      ['period', '2026-11-01', '2026-11-01'],
      ['period', '2026-11-02', '2026-11-02'],
      ['period', '2026-11-03', '2026-11-03'],
      ['not-evaluated', '2026-11-04', '2026-11-06'],
    ]);
  });
});

describe('summaries never invent a result', () => {
  it('only not-evaluated days: no achievement rate at all', () => {
    const { valueForRange, requested } = activityValues(() => 10);
    const evaluated = evaluateTimeline(timelineSegments([], { start: d('2026-11-01'), end: d('2026-11-30') }), valueForRange, d('2026-12-10'));
    expect(requested).toHaveLength(0);
    expect(summarizeTimeline(evaluated)).toEqual({
      achieved: 0,
      missed: 0,
      inProgress: 0,
      upcoming: 0,
      notEvaluatedDays: 30,
      achievementRate: null,
    });
  });

  it('upcoming periods are not computed and do not count', () => {
    const { valueForRange, requested } = activityValues(() => 1);
    const versions: GoalVersionSpan[] = [
      { id: 'v1', period: 'weekly', targetValue: 7, effectiveFrom: d('2026-11-02'), effectiveTo: null },
    ];
    const evaluated = evaluateTimeline(timelineSegments(versions, { start: d('2026-11-02'), end: d('2026-11-15') }), valueForRange, d('2026-11-08'));
    expect(evaluated.map((s) => (s.kind === 'period' ? [s.start, 'value' in s ? s.value : 'no value', s.outcome] : null))).toEqual([
      ['2026-11-02', 7, 'achieved'],
      ['2026-11-09', 'no value', 'upcoming'],
    ]);
    expect(requested).toEqual([{ start: '2026-11-02', end: '2026-11-08' }]);
    expect(summarizeTimeline(evaluated).achievementRate).toBe(1);
  });

  it('the achievement rate ignores periods in progress', () => {
    const { valueForRange } = activityValues((day) => (day <= '2026-11-08' ? 1 : 0));
    const versions: GoalVersionSpan[] = [
      { id: 'v1', period: 'weekly', targetValue: 7, effectiveFrom: d('2026-10-26'), effectiveTo: null },
    ];
    const summary = summarizeTimeline(
      evaluateTimeline(timelineSegments(versions, { start: d('2026-10-26'), end: d('2026-11-10') }), valueForRange, d('2026-11-10'))
    );
    expect(summary).toMatchObject({ achieved: 2, missed: 0, inProgress: 1, achievementRate: 1 });
  });
});

describe('timeline validation mirrors the database invariants', () => {
  const week = (id: string, from: string, to: string | null): GoalVersionSpan => ({
    id,
    period: 'weekly',
    targetValue: 1,
    effectiveFrom: d(from),
    effectiveTo: to === null ? null : d(to),
  });

  it.each([
    ['a start that is not a Monday', [week('a', '2026-11-03', null)]],
    ['an end that is not a Sunday', [week('a', '2026-11-02', '2026-11-07')]],
    ['overlapping versions', [week('a', '2026-11-02', '2026-11-15'), week('b', '2026-11-09', null)]],
    ['an open version that is not the last', [week('a', '2026-11-02', null), week('b', '2026-11-16', null)]],
    ['versions out of order', [week('b', '2026-11-16', null), week('a', '2026-11-02', '2026-11-08')]],
    ['a zero target', [{ ...week('a', '2026-11-02', null), targetValue: 0 }]],
  ])('rejects %s', (_label, versions) => {
    expect(() => assertValidTimeline(versions)).toThrow(RangeError);
    expect(() => timelineSegments(versions, { start: d('2026-11-02'), end: d('2026-11-30') })).toThrow(RangeError);
  });

  it('clips not-evaluated intervals to the requested range and returns whole periods', () => {
    const versions = [week('a', '2026-11-09', null)];
    expect(timelineSegments(versions, { start: d('2026-11-05'), end: d('2026-11-11') }).map((s) => [s.kind, s.start, s.end])).toEqual([
      ['not-evaluated', '2026-11-05', '2026-11-08'],
      ['period', '2026-11-09', '2026-11-15'],
    ]);
  });

  it('rejects a range that ends before it starts', () => {
    expect(() => timelineSegments([], { start: d('2026-11-05'), end: d('2026-11-04') })).toThrow(RangeError);
  });
});
