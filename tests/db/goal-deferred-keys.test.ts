/**
 * Guard tests of the two circular foreign keys between goals and goal_versions.
 *
 * drizzle-kit 0.31.11 never emits DEFERRABLE: the clause is a manual patch of `0000_init.sql`
 * (src/db/README.md). These tests fail if a migration loses it, for example when drizzle-kit
 * recreates one of the two tables.
 */
import { DrizzleError, eq } from 'drizzle-orm';
import type { Database, SqlJsStatic } from 'sql.js';

import { goals, goalVersions } from '@/db/schema';

import {
  T0,
  count,
  inTransaction,
  insertRow,
  isAutocommit,
  loadEngine,
  migratedDatabase,
  rows,
  scalar,
  sqliteMessage,
  uuid,
  type NourDb,
} from './support/database';

let SQL: SqlJsStatic;
let raw: Database;
let db: NourDb;

beforeAll(async () => {
  SQL = await loadEngine();
});

beforeEach(() => {
  ({ raw, db } = migratedDatabase(SQL));
});

afterEach(() => raw.close());

const G1 = uuid(1);
const V1 = uuid(11);
const V2 = uuid(12);
const V3 = uuid(13);

type Tx = Parameters<Parameters<NourDb['transaction']>[0]>[0];

const goalRow = (id: string, currentVersionId: string | null) => ({
  id,
  title: 'Weekly dhikr',
  activity: 'dhikr' as const,
  metric: 'sessions' as const,
  status: 'active' as const,
  currentVersionId,
  createdAt: T0,
  updatedAt: T0,
});

const versionRow = (id: string, goalId: string, effectiveFrom: string) => ({
  id,
  goalId,
  period: 'weekly' as const,
  targetValue: 3,
  effectiveFrom,
  openRef: id,
  createdAt: T0,
  updatedAt: T0,
});

const createGoal = (tx: Tx, goalId: string, versionId: string, effectiveFrom = '2026-11-02') => {
  tx.insert(goals).values(goalRow(goalId, versionId)).run();
  tx.insert(goalVersions).values(versionRow(versionId, goalId, effectiveFrom)).run();
};

const closeVersion = (tx: Tx, versionId: string, effectiveTo: string) =>
  tx.update(goalVersions).set({ effectiveTo, openRef: null, updatedAt: T0 }).where(eq(goalVersions.id, versionId)).run();

/** Every row of both tables, to prove that a failed transaction left nothing behind. */
const snapshot = () => ({
  goals: rows(raw, 'SELECT * FROM goals ORDER BY id'),
  versions: rows(raw, 'SELECT * FROM goal_versions ORDER BY id'),
});

function expectCommitFailure(body: (tx: Tx) => void) {
  let caught: unknown;
  try {
    db.transaction(body);
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeDefined();
  // Documented Drizzle limit: the COMMIT failure is wrapped, the SQLite message is in `cause`.
  expect(caught).toBeInstanceOf(DrizzleError);
  expect((caught as Error).message).toContain('commit');
  expect(sqliteMessage(caught)).toBe('FOREIGN KEY constraint failed');
}

describe('1. the applied SQL carries exactly the two deferred clauses', () => {
  const ddl = (table: string) => String(scalar(raw, `SELECT sql FROM sqlite_master WHERE name = ?`, [table]));

  it('goals: the current version key, and only it, is DEFERRABLE INITIALLY DEFERRED', () => {
    expect(ddl('goals').match(/DEFERRABLE INITIALLY DEFERRED/g)).toHaveLength(1);
    expect(ddl('goals')).toMatch(
      /FOREIGN KEY \(`current_version_id`,`id`\) REFERENCES `goal_versions`\(`open_ref`,`goal_id`\) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,/
    );
  });

  it('goal_versions: the open version key, and only it, is DEFERRABLE INITIALLY DEFERRED', () => {
    expect(ddl('goal_versions').match(/DEFERRABLE INITIALLY DEFERRED/g)).toHaveLength(1);
    expect(ddl('goal_versions')).toMatch(
      /FOREIGN KEY \(`goal_id`,`open_ref`\) REFERENCES `goals`\(`id`,`current_version_id`\) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,/
    );
  });

  it('no other object of the schema is deferred', () => {
    const all = rows(raw, `SELECT name, sql FROM sqlite_master WHERE sql LIKE '%DEFERRABLE%'`);
    expect(all.map((r) => r.name).sort()).toEqual(['goal_versions', 'goals']);
    const total = all.reduce((n, r) => n + (String(r.sql).match(/DEFERRABLE/g) ?? []).length, 0);
    expect(total).toBe(2);
  });

  it('the other foreign key of goal_versions stays immediate', () => {
    // goal_versions.goal_id -> goals.id is checked at once: a version cannot precede its goal.
    raw.exec('BEGIN');
    expect(() =>
      insertRow(raw, 'goal_versions', {
        id: V1, goal_id: G1, period: 'weekly', target_value: 3, effective_from: '2026-11-02',
        open_ref: V1, created_at: T0, updated_at: T0,
      })
    ).toThrow('FOREIGN KEY constraint failed');
    raw.exec('ROLLBACK');
    expect(count(raw, 'goal_versions')).toBe(0);
  });
});

describe('2. creating a goal and its first version in one transaction', () => {
  it('succeeds through a Drizzle transaction', () => {
    db.transaction((tx) => createGoal(tx, G1, V1));
    expect(count(raw, 'goals')).toBe(1);
    expect(count(raw, 'goal_versions')).toBe(1);
    expect(scalar(raw, 'SELECT current_version_id FROM goals')).toBe(V1);
    expect(scalar(raw, 'SELECT open_ref FROM goal_versions')).toBe(V1);
  });

  it('the goal alone is accepted statement by statement, then refused at COMMIT', () => {
    raw.exec('BEGIN');
    expect(() => insertRow(raw, 'goals', {
      id: G1, title: 'Goal', activity: 'dhikr', metric: 'sessions', status: 'active',
      current_version_id: V1, created_at: T0, updated_at: T0,
    })).not.toThrow();
    expect(() => raw.exec('COMMIT')).toThrow('FOREIGN KEY constraint failed');
    raw.exec('ROLLBACK');
    expect(count(raw, 'goals')).toBe(0);
  });
});

describe('3 and 4. an inconsistent state is refused at COMMIT and fully rolled back', () => {
  beforeEach(() => {
    db.transaction((tx) => createGoal(tx, G1, V1));
  });

  it.each([
    [
      'a new goal pointing to a missing version',
      (tx: Tx) => {
        tx.insert(goals).values(goalRow(uuid(2), uuid(99))).run();
      },
    ],
    [
      'a new goal pointing to the open version of another goal',
      (tx: Tx) => {
        tx.insert(goals).values(goalRow(uuid(2), V1)).run();
      },
    ],
    [
      'an open version that its goal does not point to',
      (tx: Tx) => {
        closeVersion(tx, V1, '2026-11-08');
        tx.insert(goalVersions).values(versionRow(V2, G1, '2026-11-09')).run();
      },
    ],
    [
      'closing the open version while the goal still points to it',
      (tx: Tx) => {
        closeVersion(tx, V1, '2026-11-08');
      },
    ],
    [
      'archiving the goal while its version stays open',
      (tx: Tx) => {
        tx.update(goals).set({ status: 'archived', archivedAt: T0, currentVersionId: null }).where(eq(goals.id, G1)).run();
      },
    ],
    [
      'pointing the goal to a version without inserting it',
      (tx: Tx) => {
        closeVersion(tx, V1, '2026-11-08');
        tx.update(goals).set({ currentVersionId: V2 }).where(eq(goals.id, G1)).run();
      },
    ],
  ])('%s', (_label, body) => {
    const before = snapshot();
    expectCommitFailure(body);
    // 4. Full rollback: both tables are byte for byte as before, and nothing is half-written.
    expect(snapshot()).toEqual(before);
    expect(rows(raw, 'PRAGMA foreign_key_check')).toEqual([]);
  });
});

describe('5. the connection is reusable after a rolled-back violation', () => {
  it('no transaction is left open and the next transactions commit normally', () => {
    db.transaction((tx) => createGoal(tx, G1, V1));
    expectCommitFailure((tx) => {
      tx.insert(goals).values(goalRow(uuid(2), uuid(99))).run();
    });

    expect(isAutocommit(raw)).toBe(true);
    db.transaction((tx) => createGoal(tx, uuid(2), uuid(21)));
    inTransaction(raw, () => raw.exec(`UPDATE goals SET title = 'Renamed' WHERE id = '${G1}'`));
    expect(count(raw, 'goals')).toBe(2);
    expect(scalar(raw, 'SELECT title FROM goals WHERE id = ?', [G1])).toBe('Renamed');
    expect(isAutocommit(raw)).toBe(true);
  });
});

describe('the operations of the model commit through Drizzle', () => {
  beforeEach(() => {
    db.transaction((tx) => createGoal(tx, G1, V1));
  });

  it('modification: close V1 at the end of its week, point to V2, insert V2', () => {
    db.transaction((tx) => {
      closeVersion(tx, V1, '2026-11-08');
      tx.update(goals).set({ currentVersionId: V2 }).where(eq(goals.id, G1)).run();
      tx.insert(goalVersions).values(versionRow(V2, G1, '2026-11-09')).run();
    });
    expect(rows(raw, 'SELECT id, effective_to, open_ref FROM goal_versions ORDER BY id')).toEqual([
      { id: V1, effective_to: '2026-11-08', open_ref: null },
      { id: V2, effective_to: null, open_ref: V2 },
    ]);
  });

  it('archive then reactivation with a new version', () => {
    db.transaction((tx) => {
      closeVersion(tx, V1, '2026-11-08');
      tx.update(goals).set({ status: 'archived', archivedAt: T0, currentVersionId: null }).where(eq(goals.id, G1)).run();
    });
    expect(scalar(raw, 'SELECT status FROM goals')).toBe('archived');

    db.transaction((tx) => {
      tx.update(goals).set({ status: 'active', archivedAt: null, currentVersionId: V3 }).where(eq(goals.id, G1)).run();
      tx.insert(goalVersions).values(versionRow(V3, G1, '2026-11-16')).run();
    });
    expect(scalar(raw, 'SELECT current_version_id FROM goals')).toBe(V3);
    expect(scalar(raw, `SELECT count(*) FROM goal_versions WHERE effective_to IS NULL`)).toBe(1);
  });

  it('cancelling a scheduled version: delete it and point to its replacement', () => {
    db.transaction((tx) => {
      closeVersion(tx, V1, '2026-11-08');
      tx.update(goals).set({ currentVersionId: V2 }).where(eq(goals.id, G1)).run();
      tx.insert(goalVersions).values(versionRow(V2, G1, '2026-11-09')).run();
    });
    db.transaction((tx) => {
      tx.update(goals).set({ currentVersionId: V3 }).where(eq(goals.id, G1)).run();
      tx.delete(goalVersions).where(eq(goalVersions.id, V2)).run();
      tx.insert(goalVersions).values({ ...versionRow(V3, G1, '2026-11-09'), targetValue: 5 }).run();
    });
    expect(rows(raw, 'SELECT id, target_value FROM goal_versions ORDER BY id')).toEqual([
      { id: V1, target_value: 3 },
      { id: V3, target_value: 5 },
    ]);
  });

  it('leaves an empty foreign_key_check and a correct integrity_check', () => {
    expect(rows(raw, 'PRAGMA foreign_key_check')).toEqual([]);
    expect(scalar(raw, 'PRAGMA integrity_check')).toBe('ok');
  });
});
