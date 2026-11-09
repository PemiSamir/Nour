/**
 * Structure of the database produced by the migrations in `drizzle/`, compared with the validated
 * model: 14 tables, their columns, types, defaults, keys and indexes, no trigger and no reference data.
 */
import { is } from 'drizzle-orm';
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { Database, SqlJsStatic } from 'sql.js';

import * as schema from '@/db/schema';
import { GOAL_PERIODS } from '@/lib/calendar';

import { count, loadEngine, migratedDatabase, rows, scalar } from './support/database';

let SQL: SqlJsStatic;
let raw: Database;

beforeAll(async () => {
  SQL = await loadEngine();
});

beforeEach(() => {
  ({ raw } = migratedDatabase(SQL));
});

afterEach(() => raw.close());

/** `!` marks a NOT NULL column. Order is the declaration order. */
const COLUMNS: Record<string, string> = {
  app_settings: 'key! value! created_at! updated_at!',
  currencies: 'code! minor_unit!',
  quran_surahs: 'number! ayah_count!',
  dhikrs: 'id! name! arabic_text transliteration translation default_target sort_order! archived_at created_at! updated_at!',
  dhikr_sessions:
    'id! dhikr_id! entry_mode! status! count! target_count started_at! last_counted_at ended_at local_date! time_zone! utc_offset_min! note created_at! updated_at!',
  nights: 'id! night_date! note created_at! updated_at!',
  night_prayer_sessions:
    'id! night_id! night_date! started_at ended_at cutoff_min! recorded_at! time_zone! utc_offset_min! note created_at! updated_at!',
  night_prayer_units: 'id! session_id! night_id! kind! rakaat! position! created_at! updated_at!',
  quran_readings:
    'id! mushaf! mode! start_page! end_page! start_surah start_ayah end_surah end_ayah duration_min occurred_at! local_date! time_zone! utc_offset_min! note created_at! updated_at!',
  fasts: 'id! local_date! kind! status! time_zone! note created_at! updated_at!',
  sadaqas:
    'id! kind! amount_minor currency description occurred_at! local_date! time_zone! utc_offset_min! note created_at! updated_at!',
  goals:
    'id! title! activity! metric! dhikr_id night_prayer_kind quran_mode currency status! archived_at current_version_id created_at! updated_at!',
  goal_versions:
    'id! goal_id! period! target_value! effective_from! effective_to open_ref change_reason created_at! updated_at!',
  goal_reminders:
    'id! goal_id! kind! time_of_day_min weekdays_mask lead_minutes only_if_incomplete! is_enabled! message created_at! updated_at!',
};

/** INTEGER columns of each table, in declaration order. Every other column is TEXT. */
const INTEGER_COLUMNS: Record<string, string> = {
  app_settings: 'created_at updated_at',
  currencies: 'minor_unit',
  quran_surahs: 'number ayah_count',
  dhikrs: 'default_target sort_order archived_at created_at updated_at',
  dhikr_sessions: 'count target_count started_at last_counted_at ended_at utc_offset_min created_at updated_at',
  nights: 'created_at updated_at',
  night_prayer_sessions: 'started_at ended_at cutoff_min recorded_at utc_offset_min created_at updated_at',
  night_prayer_units: 'rakaat position created_at updated_at',
  quran_readings:
    'start_page end_page start_surah start_ayah end_surah end_ayah duration_min occurred_at utc_offset_min created_at updated_at',
  fasts: 'created_at updated_at',
  sadaqas: 'amount_minor occurred_at utc_offset_min created_at updated_at',
  goals: 'archived_at created_at updated_at',
  goal_versions: 'target_value created_at updated_at',
  goal_reminders: 'time_of_day_min weekdays_mask lead_minutes only_if_incomplete is_enabled created_at updated_at',
};

/** Every declared default of the schema, as SQLite stores it. No other column has a default. */
const DEFAULTS = [
  'dhikrs.sort_order = 0',
  'dhikr_sessions.count = 0',
  "quran_readings.mushaf = 'madinah_604'",
  'goal_reminders.only_if_incomplete = 1',
  'goal_reminders.is_enabled = 1',
];

/** The INTEGER PRIMARY KEY is the rowid: SQLite already refuses anything but an integer. */
const ROWID_COLUMNS = ['quran_surahs.number'];

const PRIMARY_KEYS: Record<string, string> = {
  app_settings: 'key',
  currencies: 'code',
  quran_surahs: 'number',
};

const REFERENCE_TABLES = ['currencies', 'quran_surahs'];
const BUSINESS_TABLES = Object.keys(COLUMNS).filter((t) => !REFERENCE_TABLES.includes(t));

/** `table: from -> parent(to) ON DELETE`. */
const FOREIGN_KEYS = [
  'dhikr_sessions: dhikr_id -> dhikrs(id) RESTRICT',
  'night_prayer_sessions: night_id,night_date -> nights(id,night_date) RESTRICT',
  'night_prayer_units: session_id,night_id -> night_prayer_sessions(id,night_id) CASCADE',
  'quran_readings: start_surah -> quran_surahs(number) RESTRICT',
  'quran_readings: end_surah -> quran_surahs(number) RESTRICT',
  'sadaqas: currency -> currencies(code) RESTRICT',
  'goals: dhikr_id -> dhikrs(id) RESTRICT',
  'goals: currency -> currencies(code) RESTRICT',
  'goals: current_version_id,id -> goal_versions(open_ref,goal_id) NO ACTION',
  'goal_versions: goal_id -> goals(id) RESTRICT',
  'goal_versions: goal_id,open_ref -> goals(id,current_version_id) NO ACTION',
  'goal_reminders: goal_id -> goals(id) RESTRICT',
];

/** `name: table(columns) [unique] [partial]`, with the collation when it is not BINARY. */
const INDEXES = [
  'dhikrs_active_name: dhikrs(name NOCASE) unique partial',
  'dhikr_sessions_one_in_progress: dhikr_sessions(status) unique partial',
  'dhikr_sessions_by_date: dhikr_sessions(local_date,status)',
  'dhikr_sessions_by_dhikr: dhikr_sessions(dhikr_id,local_date)',
  'nights_night_date_unique: nights(night_date) unique',
  'nights_id_night_date_unique: nights(id,night_date) unique',
  'night_prayer_sessions_by_night: night_prayer_sessions(night_id)',
  'night_prayer_sessions_id_night_unique: night_prayer_sessions(id,night_id) unique',
  'night_prayer_units_by_night: night_prayer_units(night_id,kind)',
  'night_prayer_units_session_position_unique: night_prayer_units(session_id,position) unique',
  'quran_readings_by_date: quran_readings(local_date,mode)',
  'fasts_by_status: fasts(status,local_date)',
  'fasts_local_date_unique: fasts(local_date) unique',
  'sadaqas_by_date: sadaqas(local_date)',
  'sadaqas_by_currency: sadaqas(currency,local_date)',
  'goals_id_current_version_unique: goals(id,current_version_id) unique',
  'goal_versions_one_open: goal_versions(goal_id) unique partial',
  'goal_versions_by_goal: goal_versions(goal_id,effective_from)',
  'goal_versions_open_ref_goal_unique: goal_versions(open_ref,goal_id) unique',
  'goal_reminders_by_goal: goal_reminders(goal_id) partial',
];

const tableNames = () =>
  rows(
    raw,
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'
       AND name <> '__drizzle_migrations' ORDER BY name`
  ).map((r) => String(r.name));

describe('tables', () => {
  it('creates exactly the 14 tables of the model: 12 business tables and 2 reference tables', () => {
    expect(tableNames()).toEqual(Object.keys(COLUMNS).sort());
    expect(BUSINESS_TABLES).toHaveLength(12);
    expect(REFERENCE_TABLES).toHaveLength(2);
  });

  it('the Drizzle schema declares the same 14 tables', () => {
    const declared = Object.values(schema as Record<string, unknown>)
      .filter((value): value is SQLiteTable => is(value, SQLiteTable))
      .map((table) => getTableConfig(table).name)
      .sort();
    expect(declared).toEqual(Object.keys(COLUMNS).sort());
  });

  it('the only other table is the Drizzle migrations journal, with one applied migration', () => {
    const all = rows(raw, `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`).map((r) => r.name);
    expect(all.filter((name) => !Object.keys(COLUMNS).includes(String(name)))).toEqual(['__drizzle_migrations']);
    expect(count(raw, '__drizzle_migrations')).toBe(1);
  });

  it.each(Object.entries(COLUMNS))('%s has the expected columns and NOT NULL flags', (table, spec) => {
    const actual = rows(raw, `PRAGMA table_info("${table}")`).map((c) => `${c.name}${c.notnull ? '!' : ''}`);
    expect(actual.join(' ')).toBe(spec);
  });

  it.each(Object.keys(COLUMNS))('%s has a single-column primary key', (table) => {
    const pk = rows(raw, `PRAGMA table_info("${table}")`).filter((c) => Number(c.pk) > 0);
    expect(pk.map((c) => c.name)).toEqual([PRIMARY_KEYS[table] ?? 'id']);
  });

  it.each(Object.keys(COLUMNS))('%s declares INTEGER and TEXT columns only, as in the model', (table) => {
    const columns = rows(raw, `PRAGMA table_info("${table}")`);
    expect(columns.filter((c) => c.type === 'INTEGER').map((c) => c.name).join(' ')).toBe(INTEGER_COLUMNS[table]);
    expect(columns.filter((c) => c.type !== 'INTEGER').map((c) => c.type)).toEqual(
      columns.filter((c) => c.type !== 'INTEGER').map(() => 'TEXT')
    );
  });

  it('declares exactly the defaults of the model', () => {
    const actual = Object.keys(COLUMNS).flatMap((table) =>
      rows(raw, `PRAGMA table_info("${table}")`)
        .filter((c) => c.dflt_value !== null)
        .map((c) => `${table}.${c.name} = ${c.dflt_value}`)
    );
    expect(actual.sort()).toEqual([...DEFAULTS].sort());
  });

  it.each(Object.keys(COLUMNS))('%s: the Drizzle schema declares the same columns, types, NOT NULL and defaults', (table) => {
    const declared = Object.values(schema as Record<string, unknown>).find(
      (value): value is SQLiteTable => is(value, SQLiteTable) && getTableConfig(value).name === table
    )!;
    const fromSchema = getTableConfig(declared).columns.map((c) => {
      // `hasDefault` is also true on the rowid primary key, which has no default value.
      const fallback = c.default !== undefined ? (typeof c.default === 'string' ? `'${c.default}'` : String(c.default)) : null;
      return [c.name, c.getSQLType().toUpperCase(), c.notNull, fallback];
    });
    const applied = rows(raw, `PRAGMA table_info("${table}")`).map((c) => [c.name, c.type, c.notnull === 1, c.dflt_value]);
    expect(fromSchema).toEqual(applied);
  });

  it('every INTEGER column except the rowid carries its typeof CHECK, NULL kept for optional ones', () => {
    const ddl = (table: string) => String(scalar(raw, `SELECT sql FROM sqlite_master WHERE name = ?`, [table]));
    let expected = 0;
    for (const table of Object.keys(COLUMNS)) {
      for (const c of rows(raw, `PRAGMA table_info("${table}")`).filter((column) => column.type === 'INTEGER')) {
        const name = `${table}_${c.name}_integer`;
        if (ROWID_COLUMNS.includes(`${table}.${c.name}`)) {
          expect({ name, present: ddl(table).includes(`"${name}"`) }).toEqual({ name, present: false });
          continue;
        }
        expected += 1;
        const body = c.notnull
          ? `typeof("${c.name}") = 'integer'`
          : `"${c.name}" IS NULL OR typeof("${c.name}") = 'integer'`;
        expect(ddl(table)).toContain(`CONSTRAINT "${name}" CHECK(${body})`);
      }
    }
    const all = rows(raw, `SELECT sql FROM sqlite_master WHERE type = 'table'`)
      .flatMap((r) => [...String(r.sql).matchAll(/CONSTRAINT "\w+_integer" CHECK/g)]);
    expect(expected).toBe(61);
    expect(all).toHaveLength(expected);
  });

  it('business tables carry created_at and updated_at, reference tables do not (documented exception)', () => {
    const hasMetadata = (table: string) => {
      const names = rows(raw, `PRAGMA table_info("${table}")`).map((c) => c.name);
      return names.includes('created_at') && names.includes('updated_at');
    };
    expect(BUSINESS_TABLES.filter((t) => !hasMetadata(t))).toEqual([]);
    expect(REFERENCE_TABLES.filter(hasMetadata)).toEqual([]);
  });
});

describe('keys and indexes', () => {
  it('declares exactly the foreign keys of the model', () => {
    const actual = Object.keys(COLUMNS).flatMap((table) => {
      const list = rows(raw, `PRAGMA foreign_key_list("${table}")`);
      const ids = [...new Set(list.map((fk) => Number(fk.id)))];
      return ids.map((id) => {
        const parts = list.filter((fk) => Number(fk.id) === id).sort((a, b) => Number(a.seq) - Number(b.seq));
        const from = parts.map((p) => p.from).join(',');
        const to = parts.map((p) => p.to).join(',');
        return `${table}: ${from} -> ${parts[0].table}(${to}) ${parts[0].on_delete}`;
      });
    });
    expect(actual.sort()).toEqual([...FOREIGN_KEYS].sort());
  });

  it('declares exactly the indexes of the model', () => {
    const actual = Object.keys(COLUMNS).flatMap((table) =>
      rows(raw, `PRAGMA index_list("${table}")`)
        .filter((index) => index.origin === 'c')
        .map((index) => {
          const columns = rows(raw, `PRAGMA index_xinfo("${index.name}")`)
            .filter((c) => c.key === 1)
            .sort((a, b) => Number(a.seqno) - Number(b.seqno))
            .map((c) => `${c.name ?? '<expr>'}${c.coll === 'BINARY' ? '' : ` ${c.coll}`}`)
            .join(',');
          return `${index.name}: ${table}(${columns})${index.unique ? ' unique' : ''}${index.partial ? ' partial' : ''}`;
        })
    );
    expect(actual.sort()).toEqual([...INDEXES].sort());
  });

  it('every parent key of a foreign key is the primary key or exactly a unique index', () => {
    // Otherwise SQLite fails every write with "foreign key mismatch".
    const uniqueKeys = (table: string) => [
      rows(raw, `PRAGMA table_info("${table}")`)
        .filter((c) => Number(c.pk) > 0)
        .map((c) => String(c.name))
        .sort()
        .join(','),
      ...rows(raw, `PRAGMA index_list("${table}")`)
        .filter((index) => index.unique && !index.partial)
        .map((index) =>
          rows(raw, `PRAGMA index_info("${index.name}")`)
            .map((c) => String(c.name))
            .sort()
            .join(',')
        ),
    ];
    for (const fk of FOREIGN_KEYS) {
      const [, parent, columns] = /-> (\w+)\(([\w,]+)\)/.exec(fk)!;
      expect({ fk, backed: uniqueKeys(parent).includes(columns.split(',').sort().join(',')) }).toEqual({
        fk,
        backed: true,
      });
    }
  });
});

describe('what 0000_init does not contain', () => {
  it('creates no trigger and no view: triggers come in 5.4', () => {
    expect(scalar(raw, `SELECT count(*) FROM sqlite_master WHERE type IN ('trigger', 'view')`)).toBe(0);
  });

  it('inserts no reference data: currencies and surahs come in a dedicated step after 5.4', () => {
    expect(count(raw, 'currencies')).toBe(0);
    expect(count(raw, 'quran_surahs')).toBe(0);
  });

  it('leaves every table empty', () => {
    for (const table of Object.keys(COLUMNS)) expect(count(raw, table)).toBe(0);
  });
});

describe('consistency with the calendar module', () => {
  it('goal version periods are exactly the calendar periods', () => {
    expect([...schema.GOAL_VERSION_PERIODS]).toEqual([...GOAL_PERIODS]);
  });
});

describe('database health after migration', () => {
  it('has foreign keys enabled, an empty foreign_key_check and a correct integrity_check', () => {
    expect(scalar(raw, 'PRAGMA foreign_keys')).toBe(1);
    expect(rows(raw, 'PRAGMA foreign_key_check')).toEqual([]);
    expect(scalar(raw, 'PRAGMA integrity_check')).toBe('ok');
  });
});
