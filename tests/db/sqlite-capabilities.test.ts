/**
 * Checks that the SQLite engine used by the tests (sql.js) supports every feature the NOUR data
 * model relies on.
 *
 * These tests do not exercise the NOUR schema: they only probe engine capabilities.
 * The SQLite bundled with expo-sqlite 58.0.15 is 3.53.3, read from its vendored sqlite3.h.
 */
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';

let SQL: SqlJsStatic;
let db: Database;

const scalar = (sql: string) => db.exec(sql)[0]?.values[0]?.[0];

function expectSqlError(sql: string, message: string) {
  expect(() => db.exec(sql)).toThrow(message);
}

const EXPO_SQLITE_BUNDLED_VERSION = '3.53.3';

const versionNumber = (v: string) => {
  const [major, minor, patch] = v.split('.').map(Number);
  return major * 1_000_000 + minor * 1_000 + patch;
};

beforeAll(async () => {
  SQL = await initSqlJs();
});

beforeEach(() => {
  db = new SQL.Database();
  db.exec('PRAGMA foreign_keys = ON');
});

afterEach(() => {
  db.close();
});

describe('SQLite versions', () => {
  it('reports the sql.js and expo-sqlite SQLite versions', () => {
    const testEngine = String(scalar('SELECT sqlite_version()'));
    const bundled = EXPO_SQLITE_BUNDLED_VERSION;
    console.log(`sql.js SQLite ${testEngine} | expo-sqlite bundled SQLite ${bundled}`);
    // RETURNING needs 3.35; the model was validated on 3.53.
    expect(versionNumber(testEngine)).toBeGreaterThanOrEqual(versionNumber('3.35.0'));
    expect(versionNumber(bundled)).toBeGreaterThanOrEqual(versionNumber('3.35.0'));
  });
});

describe('SQLite features used by the NOUR model', () => {
  it('enables foreign keys on the connection', () => {
    expect(scalar('PRAGMA foreign_keys')).toBe(1);
  });

  it('supports JSON functions', () => {
    expect(scalar(`SELECT json_valid('{"a":1}')`)).toBe(1);
    expect(scalar(`SELECT json_valid('{a')`)).toBe(0);
    expect(scalar(`SELECT json_group_array(x) FROM (SELECT 1 AS x UNION ALL SELECT 2)`)).toBe('[1,2]');
  });

  it('supports RETURNING and ON CONFLICT DO NOTHING', () => {
    db.exec('CREATE TABLE t (id TEXT PRIMARY KEY, v INTEGER)');
    const first = db.exec(`INSERT INTO t VALUES ('a', 1) ON CONFLICT DO NOTHING RETURNING id`);
    const second = db.exec(`INSERT INTO t VALUES ('a', 2) ON CONFLICT DO NOTHING RETURNING id`);
    expect(first[0]?.values).toEqual([['a']]);
    expect(second).toEqual([]);
    expect(scalar(`SELECT v FROM t WHERE id = 'a'`)).toBe(1);
  });

  it('supports partial unique indexes', () => {
    db.exec(`CREATE TABLE s (id INTEGER PRIMARY KEY, status TEXT NOT NULL)`);
    db.exec(`CREATE UNIQUE INDEX one_open ON s(status) WHERE status = 'open'`);
    db.exec(`INSERT INTO s (status) VALUES ('open'), ('closed'), ('closed')`);
    expectSqlError(`INSERT INTO s (status) VALUES ('open')`, 'UNIQUE constraint failed');
  });

  it('rejects invalid dates with the IS date() check, and computes periods', () => {
    db.exec(`CREATE TABLE d (x TEXT NOT NULL CHECK (x IS date(x)))`);
    db.exec(`INSERT INTO d VALUES ('2026-01-05')`);
    expectSqlError(`INSERT INTO d VALUES ('abc')`, 'CHECK constraint failed');
    expectSqlError(`INSERT INTO d VALUES ('2026-02-30')`, 'CHECK constraint failed');
    expect(scalar(`SELECT date('2026-11-08', '-6 days', 'weekday 1')`)).toBe('2026-11-02');
    expect(scalar(`SELECT strftime('%w', '2026-11-02')`)).toBe('1');
    expect(scalar(`SELECT date(1767315600, 'unixepoch')`)).toBe('2026-01-02');
  });

  it('supports triggers that raise errors', () => {
    db.exec(`CREATE TABLE g (id TEXT PRIMARY KEY)`);
    db.exec(`CREATE TRIGGER g_no_delete BEFORE DELETE ON g BEGIN SELECT RAISE(ABORT, 'no delete'); END`);
    db.exec(`INSERT INTO g VALUES ('x')`);
    expectSqlError(`DELETE FROM g`, 'no delete');
  });

  it('checks deferred foreign keys at COMMIT and rolls back cleanly', () => {
    db.exec(`
      CREATE TABLE parent (id TEXT PRIMARY KEY, child_id TEXT,
        FOREIGN KEY (child_id) REFERENCES child(id) DEFERRABLE INITIALLY DEFERRED);
      CREATE TABLE child (id TEXT PRIMARY KEY);
    `);
    db.exec('BEGIN');
    db.exec(`INSERT INTO parent VALUES ('p', 'c')`);
    db.exec(`INSERT INTO child VALUES ('c')`);
    db.exec('COMMIT');
    expect(scalar('SELECT count(*) FROM parent')).toBe(1);

    db.exec('BEGIN');
    db.exec(`INSERT INTO parent VALUES ('q', 'missing')`);
    expect(() => db.exec('COMMIT')).toThrow('FOREIGN KEY constraint failed');
    db.exec('ROLLBACK');
    expect(scalar(`SELECT count(*) FROM parent WHERE id = 'q'`)).toBe(0);
  });

  it('ignores PRAGMA foreign_keys inside a transaction', () => {
    db.exec('BEGIN');
    db.exec('PRAGMA foreign_keys = OFF');
    expect(scalar('PRAGMA foreign_keys')).toBe(1);
    db.exec('COMMIT');
    db.exec('PRAGMA foreign_keys = OFF');
    expect(scalar('PRAGMA foreign_keys')).toBe(0);
  });
});
