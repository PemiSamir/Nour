/**
 * Checks that the TypeScript calendar functions give exactly the same results as the SQLite
 * expressions used by the NOUR database constraints, on many dates and instants.
 */
import initSqlJs, { type Database } from 'sql.js';

import {
  addDays,
  assertLocalDate,
  GOAL_PERIODS,
  isPeriodEnd,
  isPeriodStart,
  localDateFromInstant,
  nightDateFromInstant,
  periodStart,
  type LocalDate,
} from '@/lib/calendar';

let db: Database;

beforeAll(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
});

afterAll(() => db.close());

function sqlScalar(sql: string, params: (string | number)[]): unknown {
  const statement = db.prepare(sql);
  try {
    statement.bind(params);
    statement.step();
    return statement.get()[0];
  } finally {
    statement.free();
  }
}

// Deterministic pseudo-random generator, so failures are reproducible.
function generator(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return state / 2_147_483_648;
  };
}

const OFFSETS = [-720, -570, -300, 0, 60, 120, 330, 345, 525, 840];

describe('instant to local date matches the SQLite constraint expression', () => {
  it('for 5 000 instants between 2000 and 2100 and offsets from UTC-12 to UTC+14', () => {
    const random = generator(42);
    const from = Date.UTC(2000, 0, 1);
    const to = Date.UTC(2100, 0, 1);
    let mismatches = 0;
    for (let i = 0; i < 5_000; i++) {
      const instant = Math.floor(from + random() * (to - from));
      const offset = OFFSETS[i % OFFSETS.length];
      const sql = sqlScalar(`SELECT date(? / 1000 + ? * 60, 'unixepoch')`, [instant, offset]);
      if (localDateFromInstant(instant, offset) !== sql) mismatches++;
    }
    expect(mismatches).toBe(0);
  });

  it('around every local midnight of a year in Paris', () => {
    let mismatches = 0;
    for (let day = 0; day < 365; day++) {
      for (const deltaMinutes of [-1, 0, 1]) {
        for (const offset of [60, 120]) {
          const instant = Date.UTC(2026, 0, 1 + day) - offset * 60_000 + deltaMinutes * 60_000;
          const sql = sqlScalar(`SELECT date(? / 1000 + ? * 60, 'unixepoch')`, [instant, offset]);
          if (localDateFromInstant(instant, offset) !== sql) mismatches++;
        }
      }
    }
    expect(mismatches).toBe(0);
  });
});

describe('night date matches the SQLite night constraint', () => {
  it('for 5 000 instants, offsets and cutoffs', () => {
    const random = generator(7);
    const from = Date.UTC(2020, 0, 1);
    const to = Date.UTC(2040, 0, 1);
    const cutoffs = [0, 300, 360, 420, 720];
    let mismatches = 0;
    for (let i = 0; i < 5_000; i++) {
      const instant = Math.floor(from + random() * (to - from));
      const offset = OFFSETS[i % OFFSETS.length];
      const cutoff = cutoffs[i % cutoffs.length];
      const sql = sqlScalar(`SELECT date(? / 1000 + ? * 60 - ? * 60, 'unixepoch')`, [instant, offset, cutoff]);
      if (nightDateFromInstant(instant, offset, cutoff) !== sql) mismatches++;
    }
    expect(mismatches).toBe(0);
  });
});

describe('period bounds match the SQLite CHECK expressions of goal_versions', () => {
  const sqlIsStart: Record<string, string> = {
    daily: `SELECT 1`,
    weekly: `SELECT strftime('%w', ?) = '1'`,
    monthly: `SELECT strftime('%d', ?) = '01'`,
    yearly: `SELECT strftime('%m-%d', ?) = '01-01'`,
  };
  const sqlIsEnd: Record<string, string> = {
    daily: `SELECT 1`,
    weekly: `SELECT strftime('%w', ?) = '0'`,
    monthly: `SELECT ?1 IS date(?1, 'start of month', '+1 month', '-1 day')`,
    yearly: `SELECT strftime('%m-%d', ?) = '12-31'`,
  };

  it('for every day of 2026 to 2029, including 2028 as a leap year', () => {
    let mismatches = 0;
    let day: LocalDate = assertLocalDate('2026-01-01');
    while (day <= '2029-12-31') {
      for (const period of GOAL_PERIODS) {
        const params = period === 'daily' ? [] : [day];
        const sqlStart = sqlScalar(sqlIsStart[period], params) === 1;
        const sqlEnd = sqlScalar(sqlIsEnd[period], params) === 1;
        if (sqlStart !== isPeriodStart(period, day) || sqlEnd !== isPeriodEnd(period, day)) mismatches++;
      }
      const sqlMonday = sqlScalar(`SELECT date(?, '-6 days', 'weekday 1')`, [day]);
      if (sqlMonday !== periodStart('weekly', day)) mismatches++;
      day = addDays(day, 1);
    }
    expect(mismatches).toBe(0);
  });
});
