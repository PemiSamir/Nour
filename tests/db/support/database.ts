/**
 * Test database: an in-memory sql.js database migrated with the Drizzle migrator, from the same
 * `drizzle/` folder as the app. Foreign keys are enabled after the migration, as the 5.5 runner will.
 *
 * Jest runs from the project root, so the migrations folder is resolved from there.
 */
import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js';
import { migrate } from 'drizzle-orm/sql-js/migrator';
import initSqlJs, { type Database, type SqlJsStatic, type SqlValue } from 'sql.js';

import * as schema from '@/db/schema';

export const MIGRATIONS_FOLDER = 'drizzle';

export type Row = Record<string, SqlValue>;
export type NourDb = SQLJsDatabase<typeof schema>;

let engine: Promise<SqlJsStatic> | undefined;

export const loadEngine = () => (engine ??= initSqlJs());

export function migratedDatabase(SQL: SqlJsStatic): { raw: Database; db: NourDb } {
  const raw = new SQL.Database();
  const db = drizzle(raw, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  raw.exec('PRAGMA foreign_keys = ON');
  return { raw, db };
}

export const scalar = (raw: Database, sql: string, params: SqlValue[] = []): SqlValue => {
  const statement = raw.prepare(sql);
  try {
    statement.bind(params);
    return statement.step() ? statement.get()[0] : null;
  } finally {
    statement.free();
  }
};

export const rows = (raw: Database, sql: string): Row[] => {
  const [result] = raw.exec(sql);
  if (!result) return [];
  return result.values.map((values) => Object.fromEntries(result.columns.map((c, i) => [c, values[i]])));
};

export const count = (raw: Database, table: string) => Number(scalar(raw, `SELECT count(*) FROM "${table}"`));

export function insertRow(raw: Database, table: string, row: Row) {
  const columns = Object.keys(row);
  raw.run(
    `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    Object.values(row)
  );
}

/** Runs statements in one transaction and rolls back whatever is left open when one fails. */
export function inTransaction(raw: Database, body: () => void) {
  raw.exec('BEGIN');
  try {
    body();
    raw.exec('COMMIT');
  } catch (error) {
    try {
      raw.exec('ROLLBACK');
    } catch {
      // SQLite already ended the transaction.
    }
    throw error;
  }
}

/** True when no transaction is open on the connection. */
export function isAutocommit(raw: Database) {
  try {
    raw.exec('BEGIN; ROLLBACK;');
    return true;
  } catch {
    return false;
  }
}

/** Deterministic UUID-shaped identifiers. */
export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Sunday 8 November 2026, 12:00 UTC, 13:00 in Paris. */
export const T0 = Date.UTC(2026, 10, 8, 12, 0);
export const META = { created_at: T0, updated_at: T0 };
export const PARIS = { time_zone: 'Europe/Paris', utc_offset_min: 60 };

/** Message of the error, or of its SQLite cause when Drizzle wrapped it. */
export function sqliteMessage(error: unknown): string {
  const cause = (error as { cause?: unknown }).cause;
  const source = cause instanceof Error ? cause : error;
  return source instanceof Error ? source.message : String(source);
}
