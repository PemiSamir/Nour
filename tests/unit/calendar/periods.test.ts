import {
  assertLocalDate,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  firstPeriodStartAfter,
  isPeriodEnd,
  isPeriodStart,
  isWithinPeriod,
  nextPeriod,
  periodContaining,
  periodEnd,
  periodStart,
  previousPeriod,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from '@/lib/calendar';

const d = assertLocalDate;

describe('days', () => {
  it('a day starts and ends on itself', () => {
    expect(startOfDay(d('2026-03-29'))).toBe('2026-03-29');
    expect(endOfDay(d('2026-03-29'))).toBe('2026-03-29');
  });
});

describe('weeks from Monday to Sunday', () => {
  it.each([
    ['2026-11-02', '2026-11-02', '2026-11-08'],
    ['2026-11-05', '2026-11-02', '2026-11-08'],
    ['2026-11-08', '2026-11-02', '2026-11-08'],
    ['2026-12-31', '2026-12-28', '2027-01-03'],
    ['2027-01-01', '2026-12-28', '2027-01-03'],
    ['2028-02-29', '2028-02-28', '2028-03-05'],
    ['2026-03-01', '2026-02-23', '2026-03-01'],
  ])('%s is in the week %s to %s', (date, start, end) => {
    expect(startOfWeek(d(date))).toBe(start);
    expect(endOfWeek(d(date))).toBe(end);
  });

  it('every week starts on a Monday and lasts 7 days', () => {
    let day = d('2026-01-01');
    for (let i = 0; i < 800; i++) {
      const range = periodContaining('weekly', day);
      expect(isPeriodStart('weekly', range.start)).toBe(true);
      expect(isPeriodEnd('weekly', range.end)).toBe(true);
      expect(isWithinPeriod(range, day)).toBe(true);
      day = nextPeriod(range).start;
    }
  });
});

describe('months', () => {
  it.each([
    ['2026-02-14', '2026-02-01', '2026-02-28'],
    ['2028-02-14', '2028-02-01', '2028-02-29'],
    ['2026-04-30', '2026-04-01', '2026-04-30'],
    ['2026-12-31', '2026-12-01', '2026-12-31'],
    ['2026-01-01', '2026-01-01', '2026-01-31'],
  ])('%s is in the month %s to %s', (date, start, end) => {
    expect(startOfMonth(d(date))).toBe(start);
    expect(endOfMonth(d(date))).toBe(end);
  });
});

describe('years', () => {
  it.each([
    ['2026-07-15', '2026-01-01', '2026-12-31'],
    ['2028-02-29', '2028-01-01', '2028-12-31'],
    ['2026-12-31', '2026-01-01', '2026-12-31'],
  ])('%s is in the year %s to %s', (date, start, end) => {
    expect(startOfYear(d(date))).toBe(start);
    expect(endOfYear(d(date))).toBe(end);
  });
});

describe('period of a date, next and previous periods', () => {
  it('finds the period that contains a date', () => {
    expect(periodContaining('monthly', d('2028-02-10'))).toEqual({
      period: 'monthly',
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });

  it.each([
    ['daily', '2026-12-31', '2027-01-01', '2027-01-01'],
    ['weekly', '2026-12-31', '2027-01-04', '2027-01-10'],
    ['monthly', '2026-12-15', '2027-01-01', '2027-01-31'],
    ['monthly', '2028-01-31', '2028-02-01', '2028-02-29'],
    ['yearly', '2026-06-01', '2027-01-01', '2027-12-31'],
  ] as const)('%s period after the one containing %s is %s to %s', (period, date, start, end) => {
    expect(nextPeriod(periodContaining(period, d(date)))).toEqual({ period, start, end });
  });

  it('goes back to the previous period across a year boundary', () => {
    expect(previousPeriod(periodContaining('monthly', d('2027-01-10')))).toEqual({
      period: 'monthly',
      start: '2026-12-01',
      end: '2026-12-31',
    });
  });

  it.each([
    ['daily', '2026-12-31', '2027-01-01'],
    ['weekly', '2026-11-08', '2026-11-09'],
    ['weekly', '2026-11-04', '2026-11-09'],
    ['monthly', '2026-11-30', '2026-12-01'],
    ['monthly', '2026-11-01', '2026-12-01'],
    ['yearly', '2026-12-31', '2027-01-01'],
  ] as const)('first %s start strictly after %s is %s', (period, date, expected) => {
    expect(firstPeriodStartAfter(period, d(date))).toBe(expected);
  });

  it('recognizes period bounds', () => {
    expect(isPeriodStart('monthly', d('2026-11-01'))).toBe(true);
    expect(isPeriodStart('monthly', d('2026-11-02'))).toBe(false);
    expect(isPeriodEnd('monthly', d('2026-02-28'))).toBe(true);
    expect(isPeriodEnd('monthly', d('2028-02-28'))).toBe(false);
    expect(isPeriodStart('yearly', d('2026-01-01'))).toBe(true);
    expect(isPeriodEnd('weekly', d('2026-11-07'))).toBe(false);
    expect(periodStart('daily', d('2026-11-07'))).toBe('2026-11-07');
    expect(periodEnd('yearly', d('2026-11-07'))).toBe('2026-12-31');
  });
});
