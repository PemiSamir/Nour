import {
  assertUtcOffset,
  isValidUtcOffset,
  localDateFromInstant,
  localDateTimeFromInstant,
  utcOffsetMinutesOf,
} from '@/lib/calendar';

// Instants are written in UTC with Date.UTC so the tests never depend on the machine time zone.
const utc = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h, mi, s);

describe('local date and time of an instant', () => {
  it.each([
    ['Paris winter, 23:30 UTC on 31 December', utc(2026, 12, 31, 23, 30), 60, '2027-01-01', 30],
    ['Paris winter, 22:59 UTC on 31 December', utc(2026, 12, 31, 22, 59), 60, '2026-12-31', 1439],
    ['Paris summer', utc(2026, 7, 14, 22, 30), 120, '2026-07-15', 30],
    ['New York winter', utc(2026, 1, 1, 4, 0), -300, '2025-12-31', 1380],
    ['Nepal, UTC+05:45', utc(2026, 5, 1, 18, 15), 345, '2026-05-02', 0],
    ['Marquesas, UTC-09:30', utc(2026, 5, 1, 9, 29), -570, '2026-04-30', 1439],
    ['Kiribati, UTC+14:00', utc(2026, 12, 31, 10, 0), 840, '2027-01-01', 0],
    ['Baker Island, UTC-12:00', utc(2027, 1, 1, 11, 59), -720, '2026-12-31', 1439],
    ['leap day in Paris', utc(2028, 2, 28, 23, 0), 60, '2028-02-29', 0],
  ])('%s', (_label, instant, offset, date, minutesOfDay) => {
    expect(localDateTimeFromInstant(instant, offset)).toEqual({ date, minutesOfDay });
  });

  it('keeps seconds out of the minutes of the day', () => {
    expect(localDateTimeFromInstant(utc(2026, 3, 1, 10, 15, 59) + 999, 0)).toEqual({
      date: '2026-03-01',
      minutesOfDay: 615,
    });
  });
});

describe('daylight saving changes in Paris', () => {
  // Spring: 2026-03-29 at 01:00 UTC, local time jumps from 02:00 to 03:00.
  it('just before the spring change, with the winter offset', () => {
    expect(localDateTimeFromInstant(utc(2026, 3, 29, 0, 59), 60)).toEqual({ date: '2026-03-29', minutesOfDay: 119 });
  });
  it('just after the spring change, with the summer offset', () => {
    expect(localDateTimeFromInstant(utc(2026, 3, 29, 1, 0), 120)).toEqual({ date: '2026-03-29', minutesOfDay: 180 });
  });
  // Autumn: 2026-10-25 at 01:00 UTC, local time goes back from 03:00 to 02:00.
  it('the repeated 02:30 in autumn gives the same date with either offset', () => {
    expect(localDateTimeFromInstant(utc(2026, 10, 25, 0, 30), 120)).toEqual({ date: '2026-10-25', minutesOfDay: 150 });
    expect(localDateTimeFromInstant(utc(2026, 10, 25, 1, 30), 60)).toEqual({ date: '2026-10-25', minutesOfDay: 150 });
  });
  it('midnight local stays on the right date around the changes', () => {
    expect(localDateFromInstant(utc(2026, 3, 28, 23, 0), 60)).toBe('2026-03-29');
    expect(localDateFromInstant(utc(2026, 10, 24, 22, 0), 120)).toBe('2026-10-25');
    expect(localDateFromInstant(utc(2026, 10, 25, 22, 59), 60)).toBe('2026-10-25');
  });
});

describe('UTC offsets', () => {
  it.each([0, 60, 120, -300, 345, -570, 840, -720, 525])('accepts %i minutes', (offset) => {
    expect(isValidUtcOffset(offset)).toBe(true);
  });

  it.each([13, 841, -721, 1.5, Number.NaN])('rejects %s minutes', (offset) => {
    expect(isValidUtcOffset(offset)).toBe(false);
    expect(() => assertUtcOffset(offset)).toThrow(RangeError);
    expect(() => localDateTimeFromInstant(0, offset)).toThrow(RangeError);
  });

  it('rejects instants that are not whole milliseconds', () => {
    expect(() => localDateTimeFromInstant(1.5, 0)).toThrow(RangeError);
  });

  it('reads the device offset with the database sign convention', () => {
    const now = new Date(utc(2026, 6, 1, 12));
    expect(utcOffsetMinutesOf(now)).toBe(now.getTimezoneOffset() === 0 ? 0 : -now.getTimezoneOffset());
    expect(Object.is(utcOffsetMinutesOf(now), -0)).toBe(false);
  });
});
