import {
  assertLocalDate,
  assertNightCutoff,
  DEFAULT_NIGHT_CUTOFF_MINUTES,
  nightDateFor,
  nightDateFromInstant,
} from '@/lib/calendar';

const d = assertLocalDate;
const at = (hours: number, minutes: number) => hours * 60 + minutes;
const utc = (y: number, mo: number, day: number, h = 0, mi = 0) => Date.UTC(y, mo - 1, day, h, mi);

describe('night attribution with the default 06:00 cutoff', () => {
  it('uses 06:00 by default', () => {
    expect(DEFAULT_NIGHT_CUTOFF_MINUTES).toBe(360);
  });

  it.each([
    ['00:00', at(0, 0), '2026-01-01'],
    ['03:00', at(3, 0), '2026-01-01'],
    ['05:59', at(5, 59), '2026-01-01'],
    ['06:00', at(6, 0), '2026-01-02'],
    ['06:01', at(6, 1), '2026-01-02'],
    ['22:00', at(22, 0), '2026-01-02'],
    ['23:59', at(23, 59), '2026-01-02'],
  ])('a prayer at %s on 2 January belongs to the night of %s', (_label, minutes, expected) => {
    expect(nightDateFor(d('2026-01-02'), minutes)).toBe(expected);
  });

  it('crosses month and year boundaries', () => {
    expect(nightDateFor(d('2027-01-01'), at(4, 0))).toBe('2026-12-31');
    expect(nightDateFor(d('2026-03-01'), at(2, 0))).toBe('2026-02-28');
    expect(nightDateFor(d('2028-03-01'), at(2, 0))).toBe('2028-02-29');
  });
});

describe('configurable cutoff', () => {
  it('applies a custom cutoff', () => {
    expect(nightDateFor(d('2026-01-02'), at(4, 59), at(5, 0))).toBe('2026-01-01');
    expect(nightDateFor(d('2026-01-02'), at(5, 0), at(5, 0))).toBe('2026-01-02');
  });

  it('with a 00:00 cutoff, every prayer stays on its own date', () => {
    expect(nightDateFor(d('2026-01-02'), at(0, 0), 0)).toBe('2026-01-02');
  });

  it.each([-1, 721, 1.5])('rejects the cutoff %s', (cutoff) => {
    expect(() => assertNightCutoff(cutoff)).toThrow(RangeError);
    expect(() => nightDateFor(d('2026-01-02'), at(3, 0), cutoff)).toThrow(RangeError);
  });

  it.each([-1, 1440, 2.5])('rejects the minutes of day %s', (minutes) => {
    expect(() => nightDateFor(d('2026-01-02'), minutes)).toThrow(RangeError);
  });
});

describe('night of an instant', () => {
  it('03:00 in Paris on 2 January belongs to the night of 1 January', () => {
    expect(nightDateFromInstant(utc(2026, 1, 2, 2, 0), 60)).toBe('2026-01-01');
  });
  it('05:59 and 06:00 in Paris', () => {
    expect(nightDateFromInstant(utc(2026, 1, 2, 4, 59), 60)).toBe('2026-01-01');
    expect(nightDateFromInstant(utc(2026, 1, 2, 5, 0), 60)).toBe('2026-01-02');
  });
  it('the spring daylight saving night in Paris', () => {
    // 01:59 local with the winter offset, then 03:30 local with the summer offset, both before 06:00.
    expect(nightDateFromInstant(utc(2026, 3, 29, 0, 59), 60)).toBe('2026-03-28');
    expect(nightDateFromInstant(utc(2026, 3, 29, 1, 30), 120)).toBe('2026-03-28');
    // 06:00 local in summer time is 04:00 UTC.
    expect(nightDateFromInstant(utc(2026, 3, 29, 3, 59), 120)).toBe('2026-03-28');
    expect(nightDateFromInstant(utc(2026, 3, 29, 4, 0), 120)).toBe('2026-03-29');
  });
  it('the autumn daylight saving night in Paris', () => {
    expect(nightDateFromInstant(utc(2026, 10, 25, 0, 30), 120)).toBe('2026-10-24');
    expect(nightDateFromInstant(utc(2026, 10, 25, 1, 30), 60)).toBe('2026-10-24');
    expect(nightDateFromInstant(utc(2026, 10, 25, 5, 0), 60)).toBe('2026-10-25');
  });
});
