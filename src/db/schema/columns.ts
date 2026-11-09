/**
 * Shared column builders and CHECK helpers for the NOUR schema.
 *
 * CHECK and partial index expressions are written with unqualified column names, through `col()`.
 * Drizzle would otherwise render `"table"."column"`, which SQLite rejects when drizzle-kit recreates
 * a table under the temporary name `__new_<table>`.
 *
 * Every value written into a CHECK is literal SQL: drizzle-kit does not inline bound parameters.
 */
import { sql, type SQL } from 'drizzle-orm';
import { check, integer, text, type SQLiteColumn } from 'drizzle-orm/sqlite-core';

/** 2000-01-01T00:00:00Z and 2100-01-01T00:00:00Z, in milliseconds. */
export const MIN_INSTANT_MS = 946_684_800_000;
export const MAX_INSTANT_MS = 4_102_444_800_000;

/** Largest stored count or amount, kept far below Number.MAX_SAFE_INTEGER. */
export const MAX_QUANTITY = 999_999_999_999_999;

/** UTC offsets, in minutes, as `-Date.prototype.getTimezoneOffset()`. */
export const MIN_UTC_OFFSET_MIN = -720;
export const MAX_UTC_OFFSET_MIN = 840;

/** Unqualified, quoted column name. */
export const col = (column: SQLiteColumn): SQL => sql`${sql.identifier(column.name)}`;

/** Integer literal written into the SQL text. */
export const lit = (value: number): SQL => {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Not a safe integer: ${value}`);
  return sql.raw(String(value));
};

/** `IN ('a', 'b')` list written into the SQL text, for enumerations of plain identifiers. */
export const inList = (values: readonly string[]): SQL => {
  for (const value of values) {
    if (!/^[a-z0-9_]+$/.test(value)) throw new RangeError(`Unsafe enumeration value: ${value}`);
  }
  return sql.raw(`(${values.map((value) => `'${value}'`).join(', ')})`);
};

/** CHECK on an enumeration column. Drizzle enums only constrain TypeScript, never SQLite. */
export const enumCheck = (name: string, column: SQLiteColumn, values: readonly string[]) =>
  check(name, sql`${col(column)} IN ${inList(values)}`);

/** CHECK on a required or optional instant, bounded from 2000 to 2100. NULL passes. */
export const instantCheck = (name: string, column: SQLiteColumn) =>
  check(name, sql`${col(column)} BETWEEN ${lit(MIN_INSTANT_MS)} AND ${lit(MAX_INSTANT_MS)}`);

/** CHECK that a `YYYY-MM-DD` text column is a real calendar date. `IS` refuses NULL, `=` would not. */
export const localDateCheck = (name: string, column: SQLiteColumn) =>
  check(name, sql`${col(column)} IS date(${col(column)})`);

/** CHECK that a local date matches its instant shifted by the stored UTC offset. */
export const localDateOfInstantCheck = (
  name: string,
  localDate: SQLiteColumn,
  instant: SQLiteColumn,
  utcOffsetMin: SQLiteColumn
) =>
  check(
    name,
    sql`${col(localDate)} IS date(${col(instant)} / 1000 + ${col(utcOffsetMin)} * 60, 'unixepoch')`
  );

/** `id`: UUID text identifier. */
export const idColumn = () => ({ id: text('id').primaryKey() });

/** CHECK on the UUID identifier length. */
export const idCheck = (name: string, id: SQLiteColumn) => check(name, sql`length(${col(id)}) = 36`);

/** `created_at` and `updated_at`, in milliseconds. Business tables only, never reference tables. */
export const metadataColumns = () => ({
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** CHECKs of the metadata columns: bounded creation instant, update never before creation. */
export const metadataChecks = (table: string, t: { createdAt: SQLiteColumn; updatedAt: SQLiteColumn }) => [
  instantCheck(`${table}_created_at_check`, t.createdAt),
  check(`${table}_updated_at_check`, sql`${col(t.updatedAt)} >= ${col(t.createdAt)}`),
];

/** IANA time zone and UTC offset in force when the activity happened. */
export const timeZoneColumns = () => ({
  timeZone: text('time_zone').notNull(),
  utcOffsetMin: integer('utc_offset_min').notNull(),
});

export const timeZoneCheck = (name: string, timeZone: SQLiteColumn) =>
  check(name, sql`length(${col(timeZone)}) BETWEEN 1 AND 64`);

export const timeZoneChecks = (table: string, t: { timeZone: SQLiteColumn; utcOffsetMin: SQLiteColumn }) => [
  timeZoneCheck(`${table}_time_zone_check`, t.timeZone),
  check(
    `${table}_utc_offset_check`,
    sql`${col(t.utcOffsetMin)} BETWEEN ${lit(MIN_UTC_OFFSET_MIN)} AND ${lit(MAX_UTC_OFFSET_MIN)} AND ${col(t.utcOffsetMin)} % 15 = 0`
  ),
];

/**
 * CHECKs that every INTEGER column of the table really holds an integer.
 *
 * Without STRICT tables, an INTEGER column keeps a non-integral REAL such as 2.5 as is, and some
 * range CHECKs accept it: `60.5 % 15 = 0` is true because `%` truncates. `typeof()` is read after
 * SQLite has applied the column affinity, so 2.0 or '5' are stored and accepted as integers.
 *
 * Optional columns keep NULL explicitly. The INTEGER PRIMARY KEY is skipped: it is the rowid and
 * SQLite already refuses anything but an integer. One CHECK per column, named
 * `<table>_<column>_integer`, placed first so that SQLite reports it before any range CHECK.
 */
export const integerChecks = (table: string, t: Record<string, SQLiteColumn>) =>
  Object.values(t)
    // The SQL type, not `columnType`: integer columns in boolean or timestamp mode are covered too.
    .filter((column) => column.getSQLType() === 'integer' && !column.primary)
    .map((column) =>
      check(
        `${table}_${column.name}_integer`,
        column.notNull
          ? sql`typeof(${col(column)}) = 'integer'`
          : sql`${col(column)} IS NULL OR typeof(${col(column)}) = 'integer'`
      )
    );
