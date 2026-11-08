import {
  addDays,
  assertLocalDate,
  compareLocalDates,
  daysBetween,
  daysInMonth,
  fromDayNumber,
  isLeapYear,
  isLocalDate,
  isoWeekday,
  localDateFromDate,
  localDateFromParts,
  localDateToParts,
  maxLocalDate,
  minLocalDate,
  parseLocalDate,
  subtractDays,
  toDayNumber,
  todayLocalDate,
} from '@/lib/calendar';

const d = assertLocalDate;

describe('parsing and validation', () => {
  it.each([
    '2026-01-01',
    '2026-12-31',
    '2028-02-29',
    '2000-02-29',
    '2026-02-28',
    '0001-01-01',
    '9999-12-31',
  ])('accepts %s', (value) => {
    expect(parseLocalDate(value)).toBe(value);
    expect(isLocalDate(value)).toBe(true);
  });

  it.each([
    ['2026-02-29', 'not a leap year'],
    ['1900-02-29', 'century not divisible by 400'],
    ['2100-02-29', 'century not divisible by 400'],
    ['2026-02-30', 'no 30 February'],
    ['2026-04-31', 'April has 30 days'],
    ['2026-13-01', 'month 13'],
    ['2026-00-10', 'month 0'],
    ['2026-01-00', 'day 0'],
    ['2026-01-32', 'day 32'],
    ['0000-01-01', 'year 0'],
    ['2026-1-5', 'missing zero padding'],
    ['20260105', 'no separators'],
    ['2026/01/05', 'wrong separator'],
    [' 2026-01-05', 'leading space'],
    ['2026-01-05T00:00', 'time component'],
    ['abc', 'not a date'],
    ['', 'empty string'],
  ])('rejects %s (%s)', (value) => {
    expect(parseLocalDate(value)).toBeNull();
    expect(isLocalDate(value)).toBe(false);
    expect(() => assertLocalDate(value)).toThrow(RangeError);
  });

  it('builds a date from parts and back', () => {
    expect(localDateFromParts({ year: 2026, month: 3, day: 9 })).toBe('2026-03-09');
    expect(localDateFromParts({ year: 2026, month: 2, day: 29 })).toBeNull();
    expect(localDateFromParts({ year: 2026, month: 1.5, day: 1 })).toBeNull();
    expect(localDateToParts(d('2028-02-29'))).toEqual({ year: 2028, month: 2, day: 29 });
  });
});

describe('leap years and month lengths', () => {
  it.each([
    [2024, true],
    [2026, false],
    [2028, true],
    [1900, false],
    [2000, true],
    [2100, false],
  ])('isLeapYear(%i) is %s', (year, expected) => {
    expect(isLeapYear(year)).toBe(expected);
  });

  it('gives February 28 or 29 days and other months their length', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
    expect(() => daysInMonth(2026, 13)).toThrow(RangeError);
  });
});

describe('comparison', () => {
  it('orders calendar dates', () => {
    expect(compareLocalDates(d('2026-01-31'), d('2026-02-01'))).toBe(-1);
    expect(compareLocalDates(d('2026-02-01'), d('2026-02-01'))).toBe(0);
    expect(compareLocalDates(d('2027-01-01'), d('2026-12-31'))).toBe(1);
    expect(minLocalDate(d('2026-05-01'), d('2026-04-30'))).toBe('2026-04-30');
    expect(maxLocalDate(d('2026-05-01'), d('2026-04-30'))).toBe('2026-05-01');
  });
});

describe('adding and subtracting days', () => {
  it.each([
    ['2026-02-28', 1, '2026-03-01'],
    ['2028-02-28', 1, '2028-02-29'],
    ['2028-02-29', 1, '2028-03-01'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2028-03-01', -1, '2028-02-29'],
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2026-01-31', 1, '2026-02-01'],
    ['2026-01-01', 365, '2027-01-01'],
    ['2028-01-01', 366, '2029-01-01'],
    ['2026-03-28', 2, '2026-03-30'],
    ['2026-10-24', 2, '2026-10-26'],
    ['2026-11-08', 0, '2026-11-08'],
  ])('%s %+i day(s) is %s', (date, days, expected) => {
    expect(addDays(d(date), days)).toBe(expected);
  });

  it('subtracts days and counts days between dates', () => {
    expect(subtractDays(d('2026-01-01'), 1)).toBe('2025-12-31');
    expect(daysBetween(d('2026-01-01'), d('2026-12-31'))).toBe(364);
    expect(daysBetween(d('2028-01-01'), d('2028-12-31'))).toBe(365);
    expect(daysBetween(d('2026-03-01'), d('2026-02-01'))).toBe(-28);
  });

  it('rejects non-integer day counts', () => {
    expect(() => addDays(d('2026-01-01'), 1.5)).toThrow(RangeError);
  });
});

describe('day numbers', () => {
  it('matches an independent UTC calendar for every day from 1900 to 2200', () => {
    // Test oracle only: Date.UTC is used to cross-check the integer algorithm.
    const first = toDayNumber(d('1900-01-01'));
    const last = toDayNumber(d('2200-12-31'));
    let mismatches = 0;
    for (let n = first; n <= last; n++) {
      const oracle = new Date(n * 86_400_000).toISOString().slice(0, 10);
      const date = fromDayNumber(n);
      if (date !== oracle || toDayNumber(date) !== n) mismatches++;
    }
    // 301 years of 365 days, plus 73 leap days: 2000 is a leap year, 1900, 2100 and 2200 are not.
    expect(last - first + 1).toBe(301 * 365 + 73);
    expect(mismatches).toBe(0);
  });

  it('starts at 1970-01-01', () => {
    expect(toDayNumber(d('1970-01-01'))).toBe(0);
    expect(fromDayNumber(-1)).toBe('1969-12-31');
  });
});

describe('ISO weekday', () => {
  it.each([
    ['2026-11-02', 1],
    ['2026-11-08', 7],
    ['2000-01-01', 6],
    ['1970-01-01', 4],
    ['2026-12-31', 4],
    ['2028-02-29', 2],
  ])('%s is weekday %i', (date, expected) => {
    expect(isoWeekday(d(date))).toBe(expected);
  });
});

describe('local date of a JavaScript Date', () => {
  it('reads the local calendar fields, including on daylight saving days', () => {
    // Built from local fields, so the expected date does not depend on the machine time zone.
    expect(localDateFromDate(new Date(2026, 2, 29, 12, 0))).toBe('2026-03-29');
    expect(localDateFromDate(new Date(2026, 9, 25, 12, 0))).toBe('2026-10-25');
    expect(localDateFromDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(todayLocalDate(new Date(2028, 1, 29, 0, 0))).toBe('2028-02-29');
  });

  it('rejects an invalid Date', () => {
    expect(() => localDateFromDate(new Date(Number.NaN))).toThrow(RangeError);
  });
});
