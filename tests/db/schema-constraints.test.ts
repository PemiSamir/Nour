/**
 * Positive and negative tests of every constraint of `0000_init`, on the SQL really applied by the
 * Drizzle migrator.
 *
 * Each CHECK is named, so each negative case asserts the exact constraint that refused the row. A
 * coverage test reads every CHECK name from sqlite_master and requires a negative case for each.
 *
 * Currencies and surahs inserted here are test fixtures, not reference data.
 */
import type { Database, SqlJsStatic } from 'sql.js';

import {
  META,
  PARIS,
  T0,
  count,
  inTransaction,
  insertRow,
  loadEngine,
  migratedDatabase,
  rows,
  scalar,
  uuid,
  type Row,
} from './support/database';

let SQL: SqlJsStatic;
let raw: Database;

beforeAll(async () => {
  SQL = await loadEngine();
});

beforeEach(() => {
  ({ raw } = migratedDatabase(SQL));
  seed();
});

afterEach(() => raw.close());

const BEFORE_2000 = 900_000_000_000;
const AFTER_2100 = 4_102_444_800_001;
const MINUTE = 60_000;

const DHIKR = uuid(1);
const NIGHT_7 = uuid(10);
const NIGHT_8 = uuid(11);
const SESSION_7 = uuid(20);
const SEED_GOAL = uuid(90);
const SEED_VERSION = uuid(91);

/** Local 05:59 and 06:00 in Paris on 8 November 2026, around the 06:00 night cutoff. */
const AT_0559 = Date.UTC(2026, 10, 8, 4, 59);
const AT_0600 = Date.UTC(2026, 10, 8, 5, 0);

function seed() {
  insertRow(raw, 'currencies', { code: 'XAF', minor_unit: 0 });
  insertRow(raw, 'currencies', { code: 'CAD', minor_unit: 2 });
  for (const [number, ayahCount] of [[1, 7], [2, 286], [3, 200]]) {
    insertRow(raw, 'quran_surahs', { number, ayah_count: ayahCount });
  }
  insertRow(raw, 'dhikrs', { id: DHIKR, name: 'Test dhikr', ...META });
  insertRow(raw, 'nights', { id: NIGHT_7, night_date: '2026-11-07', ...META });
  insertRow(raw, 'nights', { id: NIGHT_8, night_date: '2026-11-08', ...META });
  insertRow(raw, 'night_prayer_sessions', {
    id: SESSION_7, night_id: NIGHT_7, night_date: '2026-11-07', cutoff_min: 360, recorded_at: T0, ...PARIS, ...META,
  });
  inTransaction(raw, () => {
    insertRow(raw, 'goals', { ...BASE.goals, id: SEED_GOAL, current_version_id: SEED_VERSION });
    insertRow(raw, 'goal_versions', { ...BASE.goal_versions, id: SEED_VERSION, goal_id: SEED_GOAL, open_ref: SEED_VERSION });
  });
}

/** A valid new row for each table, consistent with the seed. */
const BASE: Record<string, Row> = {
  app_settings: { key: 'theme', value: '"dark"', ...META },
  currencies: { code: 'EUR', minor_unit: 2 },
  quran_surahs: { number: 112, ayah_count: 4 },
  dhikrs: { id: uuid(2), name: 'Second dhikr', ...META },
  dhikr_sessions: {
    id: uuid(30), dhikr_id: DHIKR, entry_mode: 'counter', status: 'in_progress', count: 0,
    started_at: T0, local_date: '2026-11-08', ...PARIS, ...META,
  },
  nights: { id: uuid(12), night_date: '2026-11-09', ...META },
  night_prayer_sessions: {
    id: uuid(21), night_id: NIGHT_8, night_date: '2026-11-08', cutoff_min: 360, recorded_at: T0, ...PARIS, ...META,
  },
  night_prayer_units: {
    id: uuid(40), session_id: SESSION_7, night_id: NIGHT_7, kind: 'witr', rakaat: 1, position: 1, ...META,
  },
  quran_readings: {
    id: uuid(50), mode: 'reading', start_page: 1, end_page: 2, occurred_at: T0, local_date: '2026-11-08',
    ...PARIS, ...META,
  },
  fasts: { id: uuid(60), local_date: '2026-11-09', kind: 'monday', status: 'planned', time_zone: 'Europe/Paris', ...META },
  sadaqas: {
    id: uuid(70), kind: 'money', amount_minor: 5000, currency: 'XAF', occurred_at: T0, local_date: '2026-11-08',
    ...PARIS, ...META,
  },
  goals: {
    id: uuid(80), title: 'Goal', activity: 'dhikr', metric: 'repetitions', status: 'active',
    current_version_id: uuid(81), ...META,
  },
  goal_versions: {
    id: uuid(81), goal_id: uuid(80), period: 'weekly', target_value: 100, effective_from: '2026-11-02',
    open_ref: uuid(81), ...META,
  },
  goal_reminders: { id: uuid(95), goal_id: SEED_GOAL, kind: 'fixed_time', time_of_day_min: 1260, ...META },
};

/**
 * Inserts the base row of `table` with `patch` applied. A goal and a version are always inserted
 * together, in one transaction, as the deferred keys require.
 */
function insertCase(table: string, patch: Row) {
  if (table === 'goals' || table === 'goal_versions') {
    const goal = { ...BASE.goals, ...(table === 'goals' ? patch : {}) };
    const version = { ...BASE.goal_versions, ...(table === 'goal_versions' ? patch : {}) };
    inTransaction(raw, () => {
      insertRow(raw, 'goals', goal);
      insertRow(raw, 'goal_versions', version);
    });
    return;
  }
  insertRow(raw, table, { ...BASE[table], ...patch });
}

const metadataCases = (table: string): [string, string, Row][] => [
  [`${table}_created_at_check`, table, { created_at: BEFORE_2000 }],
  [`${table}_created_at_check`, table, { created_at: AFTER_2100, updated_at: AFTER_2100 }],
  [`${table}_updated_at_check`, table, { updated_at: T0 - 1 }],
];
const idCase = (table: string): [string, string, Row] => [`${table}_id_check`, table, { id: 'not-a-uuid' }];
const timeZoneCases = (table: string): [string, string, Row][] => [
  [`${table}_time_zone_check`, table, { time_zone: '' }],
  [`${table}_time_zone_check`, table, { time_zone: 'x'.repeat(65) }],
  [`${table}_utc_offset_check`, table, { utc_offset_min: 7 }],
  // 12:00 UTC + 14:15 is the next day, 12:00 UTC - 12:15 the previous one.
  [`${table}_utc_offset_check`, table, { utc_offset_min: 855, local_date: '2026-11-09' }],
  [`${table}_utc_offset_check`, table, { utc_offset_min: -735, local_date: '2026-11-07' }],
];

/**
 * [table, column, non-integral value, matching integer, context]. With the context applied, the
 * non-integral value passes every other CHECK of the table, so only `<table>_<column>_integer` can
 * refuse it, and the matching integer is accepted. `direct` inserts the row alone, outside
 * `insertCase`, for an archived goal that has no version.
 */
type IntegerCase = { table: string; column: string; decimal: number; integer: number; context?: Row; direct?: boolean };

const ARCHIVED_GOAL: Row = { status: 'archived', current_version_id: null };

const intCase = (table: string, column: string, decimal: number, integer: number, context?: Row, direct?: boolean) =>
  ({ table, column, decimal, integer, context, direct }) as IntegerCase;
const metadataIntegerCases = (table: string) => [
  intCase(table, 'created_at', T0 - 0.5, T0 - 1),
  intCase(table, 'updated_at', T0 + 0.5, T0 + 1),
];
const offsetIntegerCase = (table: string) => intCase(table, 'utc_offset_min', 60.5, 60);

const INTEGER_CASES: IntegerCase[] = [
  ...metadataIntegerCases('app_settings'),
  intCase('currencies', 'minor_unit', 1.5, 1),
  intCase('quran_surahs', 'ayah_count', 4.5, 5),
  intCase('dhikrs', 'default_target', 2.5, 2),
  intCase('dhikrs', 'sort_order', 1.5, 1),
  intCase('dhikrs', 'archived_at', T0 + 0.5, T0 + 1),
  ...metadataIntegerCases('dhikrs'),
  intCase('dhikr_sessions', 'count', 1.5, 1),
  intCase('dhikr_sessions', 'target_count', 2.5, 2),
  intCase('dhikr_sessions', 'started_at', T0 + 0.5, T0 + 1),
  intCase('dhikr_sessions', 'last_counted_at', T0 + 0.5, T0 + 1),
  intCase('dhikr_sessions', 'ended_at', T0 + 0.5, T0 + 1, { status: 'completed', count: 1 }),
  offsetIntegerCase('dhikr_sessions'),
  ...metadataIntegerCases('dhikr_sessions'),
  ...metadataIntegerCases('nights'),
  intCase('night_prayer_sessions', 'started_at', AT_0600 + 0.5, AT_0600 + 1),
  intCase('night_prayer_sessions', 'ended_at', AT_0600 + MINUTE + 0.5, AT_0600 + MINUTE, { started_at: AT_0600 }),
  intCase('night_prayer_sessions', 'cutoff_min', 359.5, 359),
  intCase('night_prayer_sessions', 'recorded_at', T0 + 0.5, T0 + 1),
  offsetIntegerCase('night_prayer_sessions'),
  ...metadataIntegerCases('night_prayer_sessions'),
  intCase('night_prayer_units', 'rakaat', 2.5, 2),
  intCase('night_prayer_units', 'position', 1.5, 2),
  ...metadataIntegerCases('night_prayer_units'),
  intCase('quran_readings', 'start_page', 1.5, 1),
  intCase('quran_readings', 'end_page', 2.5, 3),
  intCase('quran_readings', 'start_surah', 1.5, 1, { end_surah: 2 }),
  intCase('quran_readings', 'start_ayah', 1.5, 1, { start_surah: 1, end_surah: 1, end_ayah: 7 }),
  intCase('quran_readings', 'end_surah', 2.5, 2, { start_surah: 1 }),
  intCase('quran_readings', 'end_ayah', 6.5, 6, { start_surah: 1, start_ayah: 1, end_surah: 1 }),
  intCase('quran_readings', 'duration_min', 30.5, 30),
  intCase('quran_readings', 'occurred_at', T0 + 0.5, T0 + 1),
  offsetIntegerCase('quran_readings'),
  ...metadataIntegerCases('quran_readings'),
  ...metadataIntegerCases('fasts'),
  intCase('sadaqas', 'amount_minor', 2.5, 2),
  intCase('sadaqas', 'occurred_at', T0 + 0.5, T0 + 1),
  offsetIntegerCase('sadaqas'),
  ...metadataIntegerCases('sadaqas'),
  intCase('goals', 'archived_at', T0 + 0.5, T0 + 1, ARCHIVED_GOAL, true),
  ...metadataIntegerCases('goals'),
  intCase('goal_versions', 'target_value', 2.5, 2),
  ...metadataIntegerCases('goal_versions'),
  intCase('goal_reminders', 'time_of_day_min', 1260.5, 1261),
  intCase('goal_reminders', 'weekdays_mask', 1.5, 1),
  intCase('goal_reminders', 'lead_minutes', 60.5, 60, { kind: 'before_period_end', time_of_day_min: null }),
  intCase('goal_reminders', 'only_if_incomplete', 0.5, 0),
  intCase('goal_reminders', 'is_enabled', 0.5, 0),
  ...metadataIntegerCases('goal_reminders'),
];

const integerCheckName = ({ table, column }: IntegerCase) => `${table}_${column}_integer`;

/** [constraint, table, patch]: the patch must be refused by exactly that CHECK. */
const CHECK_CASES: [string, string, Row][] = [
  ...INTEGER_CASES.map((c): [string, string, Row] => [integerCheckName(c), c.table, { ...c.context, [c.column]: c.decimal }]),
  ['app_settings_key_check', 'app_settings', { key: '' }],
  ['app_settings_key_check', 'app_settings', { key: 'k'.repeat(101) }],
  ['app_settings_value_check', 'app_settings', { value: '{not json' }],
  ...metadataCases('app_settings'),

  ['currencies_code_check', 'currencies', { code: 'eur' }],
  ['currencies_code_check', 'currencies', { code: 'EU' }],
  ['currencies_minor_unit_check', 'currencies', { minor_unit: 5 }],
  ['currencies_minor_unit_check', 'currencies', { minor_unit: -1 }],

  ['quran_surahs_number_check', 'quran_surahs', { number: 0 }],
  ['quran_surahs_number_check', 'quran_surahs', { number: 115 }],
  ['quran_surahs_ayah_count_check', 'quran_surahs', { ayah_count: 2 }],
  ['quran_surahs_ayah_count_check', 'quran_surahs', { ayah_count: 287 }],

  idCase('dhikrs'),
  ['dhikrs_name_check', 'dhikrs', { name: '   ' }],
  ['dhikrs_name_check', 'dhikrs', { name: 'n'.repeat(121) }],
  ['dhikrs_default_target_check', 'dhikrs', { default_target: 0 }],
  ['dhikrs_archived_at_check', 'dhikrs', { archived_at: T0 - 1 }],
  ...metadataCases('dhikrs'),

  idCase('dhikr_sessions'),
  ['dhikr_sessions_entry_mode_check', 'dhikr_sessions', { entry_mode: 'voice' }],
  ['dhikr_sessions_status_check', 'dhikr_sessions', { status: 'paused' }],
  ['dhikr_sessions_count_check', 'dhikr_sessions', { count: -1 }],
  ['dhikr_sessions_target_count_check', 'dhikr_sessions', { target_count: 0 }],
  ['dhikr_sessions_started_at_check', 'dhikr_sessions', { started_at: BEFORE_2000 }],
  ['dhikr_sessions_last_counted_at_check', 'dhikr_sessions', { last_counted_at: T0 - 1 }],
  ['dhikr_sessions_ended_at_check', 'dhikr_sessions', { status: 'completed', count: 5, ended_at: T0 - 1 }],
  ['dhikr_sessions_local_date_check', 'dhikr_sessions', { local_date: '2026-11-09' }],
  ...timeZoneCases('dhikr_sessions'),
  ...metadataCases('dhikr_sessions'),
  ['dhikr_sessions_open_check', 'dhikr_sessions', { status: 'completed', count: 5 }],
  ['dhikr_sessions_open_check', 'dhikr_sessions', { ended_at: T0 + MINUTE }],
  ['dhikr_sessions_manual_check', 'dhikr_sessions', { entry_mode: 'manual', status: 'abandoned', ended_at: T0 }],
  ['dhikr_sessions_completed_count_check', 'dhikr_sessions', { status: 'completed', count: 0, ended_at: T0 }],

  idCase('nights'),
  ['nights_night_date_check', 'nights', { night_date: '2026-02-30' }],
  ['nights_night_date_check', 'nights', { night_date: 'abc' }],
  ...metadataCases('nights'),

  idCase('night_prayer_sessions'),
  ['night_prayer_sessions_started_at_check', 'night_prayer_sessions', { started_at: BEFORE_2000 }],
  ['night_prayer_sessions_cutoff_check', 'night_prayer_sessions', { cutoff_min: 721 }],
  ['night_prayer_sessions_cutoff_check', 'night_prayer_sessions', { cutoff_min: -1 }],
  ['night_prayer_sessions_recorded_at_check', 'night_prayer_sessions', { recorded_at: BEFORE_2000 }],
  ['night_prayer_sessions_time_zone_check', 'night_prayer_sessions', { time_zone: '' }],
  ['night_prayer_sessions_utc_offset_check', 'night_prayer_sessions', { utc_offset_min: 7 }],
  ['night_prayer_sessions_utc_offset_check', 'night_prayer_sessions', { utc_offset_min: 855 }],
  ...metadataCases('night_prayer_sessions'),
  ['night_prayer_sessions_end_needs_start_check', 'night_prayer_sessions', { ended_at: T0 }],
  [
    'night_prayer_sessions_duration_check',
    'night_prayer_sessions',
    { night_id: NIGHT_7, night_date: '2026-11-07', started_at: AT_0559, ended_at: AT_0559 - 1 },
  ],
  [
    'night_prayer_sessions_duration_check',
    'night_prayer_sessions',
    { night_id: NIGHT_7, night_date: '2026-11-07', started_at: AT_0559, ended_at: AT_0559 + 12 * 60 * MINUTE + 1 },
  ],
  // 05:59 belongs to the night of the 7th, 06:00 to the night of the 8th.
  ['night_prayer_sessions_night_date_check', 'night_prayer_sessions', { started_at: AT_0559 }],
  [
    'night_prayer_sessions_night_date_check',
    'night_prayer_sessions',
    { night_id: NIGHT_7, night_date: '2026-11-07', started_at: AT_0600 },
  ],

  idCase('night_prayer_units'),
  ['night_prayer_units_kind_check', 'night_prayer_units', { kind: 'fajr' }],
  ['night_prayer_units_rakaat_check', 'night_prayer_units', { rakaat: 0 }],
  ['night_prayer_units_rakaat_check', 'night_prayer_units', { rakaat: 100 }],
  ['night_prayer_units_position_check', 'night_prayer_units', { position: 0 }],
  ...metadataCases('night_prayer_units'),

  idCase('quran_readings'),
  ['quran_readings_mushaf_check', 'quran_readings', { mushaf: 'other_mushaf' }],
  ['quran_readings_mode_check', 'quran_readings', { mode: 'listening' }],
  ['quran_readings_start_page_check', 'quran_readings', { start_page: 0 }],
  ['quran_readings_start_page_check', 'quran_readings', { start_page: 605, end_page: 605 }],
  ['quran_readings_end_page_check', 'quran_readings', { start_page: 3, end_page: 2 }],
  ['quran_readings_end_page_check', 'quran_readings', { end_page: 605 }],
  ['quran_readings_start_ayah_check', 'quran_readings', { start_surah: 1, end_surah: 1, start_ayah: 0, end_ayah: 1 }],
  ['quran_readings_end_ayah_check', 'quran_readings', { start_surah: 1, end_surah: 2, start_ayah: 1, end_ayah: 0 }],
  ['quran_readings_duration_check', 'quran_readings', { duration_min: 0 }],
  ['quran_readings_duration_check', 'quran_readings', { duration_min: 1441 }],
  ['quran_readings_occurred_at_check', 'quran_readings', { occurred_at: BEFORE_2000 }],
  ['quran_readings_local_date_check', 'quran_readings', { local_date: '2026-11-09' }],
  ...timeZoneCases('quran_readings'),
  ...metadataCases('quran_readings'),
  ['quran_readings_surah_pair_check', 'quran_readings', { start_surah: 1 }],
  ['quran_readings_surah_pair_check', 'quran_readings', { end_surah: 1 }],
  ['quran_readings_ayah_pair_check', 'quran_readings', { start_surah: 1, end_surah: 1, start_ayah: 1 }],
  ['quran_readings_ayah_needs_surah_check', 'quran_readings', { start_ayah: 1, end_ayah: 2 }],
  ['quran_readings_range_order_check', 'quran_readings', { start_surah: 2, end_surah: 1 }],
  ['quran_readings_range_order_check', 'quran_readings', { start_surah: 2, end_surah: 2, start_ayah: 5, end_ayah: 3 }],

  idCase('fasts'),
  ['fasts_local_date_check', 'fasts', { local_date: '2026-13-01' }],
  ['fasts_kind_check', 'fasts', { kind: 'ramadan' }],
  ['fasts_status_check', 'fasts', { status: 'skipped' }],
  ['fasts_time_zone_check', 'fasts', { time_zone: '' }],
  ...metadataCases('fasts'),

  idCase('sadaqas'),
  ['sadaqas_kind_check', 'sadaqas', { kind: 'gold' }],
  ['sadaqas_amount_check', 'sadaqas', { amount_minor: 0 }],
  ['sadaqas_amount_check', 'sadaqas', { amount_minor: 1_000_000_000_000_000 }],
  ['sadaqas_occurred_at_check', 'sadaqas', { occurred_at: BEFORE_2000 }],
  ['sadaqas_local_date_check', 'sadaqas', { local_date: '2026-11-09' }],
  ...timeZoneCases('sadaqas'),
  ...metadataCases('sadaqas'),
  ['sadaqas_amount_currency_check', 'sadaqas', { kind: 'other', currency: null }],
  ['sadaqas_amount_currency_check', 'sadaqas', { kind: 'other', amount_minor: null }],
  ['sadaqas_money_amount_check', 'sadaqas', { amount_minor: null, currency: null }],

  idCase('goals'),
  ['goals_title_check', 'goals', { title: ' ' }],
  ['goals_title_check', 'goals', { title: 't'.repeat(121) }],
  ['goals_activity_check', 'goals', { activity: 'prayer' }],
  ['goals_night_prayer_kind_check', 'goals', { activity: 'night_prayer', metric: 'rakaat', night_prayer_kind: 'fajr' }],
  ['goals_quran_mode_check', 'goals', { activity: 'quran', metric: 'pages', quran_mode: 'listening' }],
  ['goals_status_check', 'goals', { status: 'paused' }],
  ...metadataCases('goals'),
  ['goals_metric_check', 'goals', { metric: 'pages' }],
  ['goals_metric_check', 'goals', { activity: 'fasting', metric: 'occurrences' }],
  ['goals_dhikr_filter_check', 'goals', { activity: 'quran', metric: 'pages', dhikr_id: DHIKR }],
  ['goals_night_prayer_filter_check', 'goals', { night_prayer_kind: 'witr' }],
  ['goals_quran_filter_check', 'goals', { quran_mode: 'reading' }],
  ['goals_currency_check', 'goals', { activity: 'sadaqa', metric: 'amount' }],
  ['goals_currency_check', 'goals', { currency: 'XAF' }],
  ['goals_archived_check', 'goals', { archived_at: T0 }],
  ['goals_archived_check', 'goals', { status: 'archived', current_version_id: null }],
  ['goals_archived_at_check', 'goals', { status: 'archived', archived_at: T0 - 1, current_version_id: null }],
  ['goals_current_version_check', 'goals', { current_version_id: null }],
  ['goals_current_version_check', 'goals', { status: 'archived', archived_at: T0 }],

  idCase('goal_versions'),
  ['goal_versions_period_check', 'goal_versions', { period: 'hourly' }],
  ['goal_versions_target_check', 'goal_versions', { target_value: 0 }],
  ['goal_versions_target_check', 'goal_versions', { target_value: 1_000_000_000_000_000 }],
  ['goal_versions_from_check', 'goal_versions', { effective_from: '2026-11-31' }],
  ['goal_versions_to_check', 'goal_versions', { effective_to: 'abc', open_ref: null }],
  ['goal_versions_to_check', 'goal_versions', { effective_to: '2026-11-01', open_ref: null }],
  ...metadataCases('goal_versions'),
  ['goal_versions_open_ref_check', 'goal_versions', { open_ref: null }],
  ['goal_versions_open_ref_check', 'goal_versions', { open_ref: uuid(99) }],
  ['goal_versions_open_ref_check', 'goal_versions', { effective_to: '2026-11-08' }],
  ['goal_versions_start_aligned_check', 'goal_versions', { effective_from: '2026-11-03' }],
  ['goal_versions_start_aligned_check', 'goal_versions', { period: 'monthly', effective_from: '2026-11-02' }],
  ['goal_versions_start_aligned_check', 'goal_versions', { period: 'yearly', effective_from: '2026-02-01' }],
  ['goal_versions_end_aligned_check', 'goal_versions', { effective_to: '2026-11-07', open_ref: null }],
  [
    'goal_versions_end_aligned_check',
    'goal_versions',
    { period: 'monthly', effective_from: '2026-11-01', effective_to: '2026-11-29', open_ref: null },
  ],
  [
    'goal_versions_end_aligned_check',
    'goal_versions',
    { period: 'yearly', effective_from: '2026-01-01', effective_to: '2026-12-30', open_ref: null },
  ],

  idCase('goal_reminders'),
  ['goal_reminders_kind_check', 'goal_reminders', { kind: 'push' }],
  ['goal_reminders_time_of_day_check', 'goal_reminders', { time_of_day_min: 1440 }],
  ['goal_reminders_time_of_day_check', 'goal_reminders', { time_of_day_min: -1 }],
  ['goal_reminders_weekdays_check', 'goal_reminders', { weekdays_mask: 0 }],
  ['goal_reminders_weekdays_check', 'goal_reminders', { weekdays_mask: 128 }],
  ['goal_reminders_lead_check', 'goal_reminders', { kind: 'before_period_end', time_of_day_min: null, lead_minutes: 0 }],
  [
    'goal_reminders_lead_check',
    'goal_reminders',
    { kind: 'before_period_end', time_of_day_min: null, lead_minutes: 527_041 },
  ],
  ['goal_reminders_only_if_incomplete_check', 'goal_reminders', { only_if_incomplete: 2 }],
  ['goal_reminders_is_enabled_check', 'goal_reminders', { is_enabled: 2 }],
  ['goal_reminders_message_check', 'goal_reminders', { message: 'm'.repeat(201) }],
  ...metadataCases('goal_reminders'),
  ['goal_reminders_fixed_time_check', 'goal_reminders', { time_of_day_min: null }],
  ['goal_reminders_fixed_time_check', 'goal_reminders', { kind: 'before_period_end', lead_minutes: 60 }],
  [
    'goal_reminders_weekdays_kind_check',
    'goal_reminders',
    { kind: 'before_period_end', time_of_day_min: null, lead_minutes: 60, weekdays_mask: 1 },
  ],
  ['goal_reminders_lead_kind_check', 'goal_reminders', { lead_minutes: 60 }],
  ['goal_reminders_lead_kind_check', 'goal_reminders', { kind: 'before_period_end', time_of_day_min: null }],
];

/** [label, table, patch]: valid rows, including every boundary of the CHECKs above. */
const VALID_CASES: [string, string, Row][] = [
  ['base row', 'app_settings', {}],
  ['JSON object value', 'app_settings', { value: '{"a":[1,2]}' }],
  ['base row', 'currencies', {}],
  ['currency without decimals', 'currencies', { code: 'JPY', minor_unit: 0 }],
  ['base row', 'quran_surahs', {}],
  ['last surah number and longest bound', 'quran_surahs', { number: 114, ayah_count: 286 }],
  ['base row', 'dhikrs', {}],
  ['archived at its creation instant', 'dhikrs', { archived_at: T0 }],
  ['120-character name', 'dhikrs', { name: 'n'.repeat(120) }],
  ['base row', 'dhikr_sessions', {}],
  ['completed counter session', 'dhikr_sessions', { status: 'completed', count: 33, ended_at: T0, last_counted_at: T0 }],
  ['manual completed session', 'dhikr_sessions', { entry_mode: 'manual', status: 'completed', count: 100, ended_at: T0 }],
  ['abandoned counter session at zero', 'dhikr_sessions', { status: 'abandoned', ended_at: T0 }],
  ['offset +14:00 on the next local day', 'dhikr_sessions', { utc_offset_min: 840, local_date: '2026-11-09' }],
  ['offset -12:00 on the same local day', 'dhikr_sessions', { utc_offset_min: -720, local_date: '2026-11-08' }],
  ['offset +05:45', 'dhikr_sessions', { utc_offset_min: 345, local_date: '2026-11-08' }],
  ['base row', 'nights', {}],
  ['29 February of a leap year', 'nights', { night_date: '2028-02-29' }],
  ['session without start time, night chosen explicitly', 'night_prayer_sessions', {}],
  ['05:59 belongs to the previous night', 'night_prayer_sessions', { night_id: NIGHT_7, night_date: '2026-11-07', started_at: AT_0559 }],
  ['06:00 belongs to the same day', 'night_prayer_sessions', { started_at: AT_0600 }],
  ['22:00 stays on its date', 'night_prayer_sessions', { started_at: Date.UTC(2026, 10, 8, 21, 0) }],
  [
    '03:00 goes to the previous night',
    'night_prayer_sessions',
    { night_id: NIGHT_7, night_date: '2026-11-07', started_at: Date.UTC(2026, 10, 8, 2, 0) },
  ],
  [
    'cutoff at midnight',
    'night_prayer_sessions',
    { cutoff_min: 0, started_at: Date.UTC(2026, 10, 7, 23, 30) },
  ],
  [
    'session of exactly 12 hours',
    'night_prayer_sessions',
    { started_at: AT_0600, ended_at: AT_0600 + 12 * 60 * MINUTE },
  ],
  ['base row', 'night_prayer_units', {}],
  ['99 rakaat', 'night_prayer_units', { kind: 'qiyam', rakaat: 99, position: 2 }],
  ['pages only', 'quran_readings', {}],
  ['whole last page', 'quran_readings', { start_page: 604, end_page: 604 }],
  ['surahs without ayahs', 'quran_readings', { start_surah: 1, end_surah: 2 }],
  ['range across surahs', 'quran_readings', { start_surah: 2, start_ayah: 280, end_surah: 3, end_ayah: 10 }],
  ['single ayah', 'quran_readings', { start_surah: 1, start_ayah: 1, end_surah: 1, end_ayah: 1, duration_min: 1440 }],
  ['base row', 'fasts', {}],
  ['base row', 'sadaqas', {}],
  ['in-kind sadaqa without amount', 'sadaqas', { kind: 'in_kind', amount_minor: null, currency: null }],
  ['largest amount', 'sadaqas', { amount_minor: 999_999_999_999_999, currency: 'CAD' }],
  ['dhikr goal with a dhikr filter', 'goals', { dhikr_id: DHIKR }],
  ['night prayer goal with a kind filter', 'goals', { activity: 'night_prayer', metric: 'nights', night_prayer_kind: 'witr' }],
  ['quran goal with a mode filter', 'goals', { activity: 'quran', metric: 'minutes', quran_mode: 'revision' }],
  ['fasting goal', 'goals', { activity: 'fasting', metric: 'days' }],
  ['sadaqa amount goal with its currency', 'goals', { activity: 'sadaqa', metric: 'amount', currency: 'XAF' }],
  ['daily version on any day', 'goal_versions', { period: 'daily', effective_from: '2026-11-04' }],
  ['monthly version', 'goal_versions', { period: 'monthly', effective_from: '2026-11-01' }],
  ['yearly version', 'goal_versions', { period: 'yearly', effective_from: '2026-01-01', target_value: 999_999_999_999_999 }],
  ['base row', 'goal_reminders', {}],
  ['fixed time on chosen weekdays', 'goal_reminders', { time_of_day_min: 0, weekdays_mask: 127 }],
  ['before the end of the period', 'goal_reminders', { kind: 'before_period_end', time_of_day_min: null, lead_minutes: 527_040 }],
  ['disabled with a 200-character message', 'goal_reminders', { is_enabled: 0, only_if_incomplete: 0, message: 'm'.repeat(200) }],
];

const exactly = (message: string) => new RegExp(`^${message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

describe('CHECK constraints', () => {
  it.each(CHECK_CASES)('%s refuses %s %j', (name, table, patch) => {
    const before = count(raw, table);
    expect(() => insertCase(table, patch)).toThrow(exactly(`CHECK constraint failed: ${name}`));
    expect(count(raw, table)).toBe(before);
  });

  it.each(VALID_CASES)('accepts %s (%s)', (_label, table, patch) => {
    const before = count(raw, table);
    insertCase(table, patch);
    expect(count(raw, table)).toBe(before + 1);
    expect(rows(raw, 'PRAGMA foreign_key_check')).toEqual([]);
    expect(scalar(raw, 'PRAGMA integrity_check')).toBe('ok');
  });

  it('every CHECK of the applied SQL has at least one negative case', () => {
    const applied = rows(raw, `SELECT sql FROM sqlite_master WHERE type = 'table'`)
      .flatMap((r) => [...String(r.sql).matchAll(/CONSTRAINT "(\w+)" CHECK/g)].map((m) => m[1]))
      .sort();
    const tested = [...new Set(CHECK_CASES.map(([name]) => name))].sort();
    expect(tested).toEqual(applied);
    expect(applied).toHaveLength(new Set(applied).size);
  });

  it('dates are checked with IS: NULL never slips through a date CHECK', () => {
    expect(scalar(raw, `SELECT NULL IS date(NULL)`)).toBe(1);
    expect(scalar(raw, `SELECT 'abc' IS date('abc')`)).toBe(0);
    expect(() => insertCase('nights', { night_date: '2026-1-5' })).toThrow('nights_night_date_check');
  });
});

describe('INTEGER columns hold integers only', () => {
  const KEY: Record<string, string> = { app_settings: 'key', currencies: 'code', quran_surahs: 'number' };

  /** Inserts the case with `value` and returns the primary key of the inserted row. */
  const insertInteger = (c: IntegerCase, value: number) => {
    const patch = { ...c.context, [c.column]: value };
    if (c.direct) insertRow(raw, c.table, { ...BASE[c.table], ...patch });
    else insertCase(c.table, patch);
    return { ...BASE[c.table], ...patch }[KEY[c.table] ?? 'id'];
  };

  it.each(INTEGER_CASES.map((c) => [integerCheckName(c), c.decimal, c] as const))('%s refuses %d', (name, _decimal, c) => {
    const before = count(raw, c.table);
    expect(() => insertInteger(c, c.decimal)).toThrow(exactly(`CHECK constraint failed: ${name}`));
    expect(count(raw, c.table)).toBe(before);
  });

  it.each(INTEGER_CASES.map((c) => [`${c.table}.${c.column}`, c.integer, c] as const))(
    '%s accepts the integer %d and stores it as an integer',
    (_label, integer, c) => {
      const key = insertInteger(c, integer);
      const keyColumn = KEY[c.table] ?? 'id';
      const stored = rows(
        raw,
        `SELECT typeof("${c.column}") AS type, "${c.column}" AS value FROM "${c.table}" WHERE "${keyColumn}" = '${key}'`
      );
      expect(stored).toEqual([{ type: 'integer', value: integer }]);
      expect(rows(raw, 'PRAGMA foreign_key_check')).toEqual([]);
      expect(scalar(raw, 'PRAGMA integrity_check')).toBe('ok');
    }
  );

  it('without the typeof CHECK, 60.5 passes the offset range CHECK and 2.5 a positive range', () => {
    expect(scalar(raw, `SELECT 60.5 BETWEEN -720 AND 840 AND 60.5 % 15 = 0`)).toBe(1);
    expect(scalar(raw, `SELECT 2.5 > 0`)).toBe(1);
  });

  it('optional INTEGER columns still accept NULL', () => {
    insertCase('dhikrs', { default_target: null, archived_at: null });
    insertCase('sadaqas', { kind: 'in_kind', amount_minor: null, currency: null });
    insertCase('quran_readings', { start_surah: null, start_ayah: null, end_surah: null, end_ayah: null, duration_min: null });
    insertCase('goal_reminders', { weekdays_mask: null, lead_minutes: null });
    expect(count(raw, 'dhikrs')).toBe(2);
    expect(count(raw, 'sadaqas')).toBe(1);
    expect(count(raw, 'quran_readings')).toBe(1);
    expect(count(raw, 'goal_reminders')).toBe(1);
  });

  it('the column affinity runs before the CHECK: an integral REAL and numeric text become integers', () => {
    // Literals in the SQL text: a bound JavaScript number cannot tell REAL 2.0 from 2.
    raw.run(`INSERT INTO currencies (code, minor_unit) VALUES ('JPY', 2.0), ('USD', '2')`);
    expect(
      rows(raw, `SELECT code, typeof(minor_unit) AS type FROM currencies WHERE code IN ('JPY', 'USD') ORDER BY code`)
    ).toEqual([
      { code: 'JPY', type: 'integer' },
      { code: 'USD', type: 'integer' },
    ]);
  });

  it('refuses text, numeric text with decimals, REAL and blobs in an INTEGER column', () => {
    const refuse = (sqlValue: string) =>
      expect(() => raw.run(`INSERT INTO currencies (code, minor_unit) VALUES ('GBP', ${sqlValue})`)).toThrow(
        exactly('CHECK constraint failed: currencies_minor_unit_integer')
      );
    refuse(`'abc'`);
    refuse(`'2.5'`);
    refuse(`2.5`);
    refuse(`x'02'`);
    expect(count(raw, 'currencies')).toBe(2);
  });

  it('updates are checked as well as inserts', () => {
    expect(() => raw.run(`UPDATE dhikrs SET sort_order = 1.5 WHERE id = ?`, [DHIKR])).toThrow(
      exactly('CHECK constraint failed: dhikrs_sort_order_integer')
    );
    raw.run(`UPDATE dhikrs SET sort_order = 2 WHERE id = ?`, [DHIKR]);
    expect(scalar(raw, `SELECT sort_order FROM dhikrs WHERE id = ?`, [DHIKR])).toBe(2);
  });

  it('instants bound from JavaScript, beyond 32 bits, are stored as integers', () => {
    insertCase('dhikr_sessions', {});
    expect(rows(raw, `SELECT typeof(started_at) AS a, typeof(created_at) AS b, started_at FROM dhikr_sessions`)).toEqual([
      { a: 'integer', b: 'integer', started_at: T0 },
    ]);
  });

  it('the rowid primary key of quran_surahs refuses a decimal without a dedicated CHECK', () => {
    expect(() => insertCase('quran_surahs', { number: 112.5 })).toThrow('datatype mismatch');
    expect(count(raw, 'quran_surahs')).toBe(3);
  });
});

describe('NOT NULL columns', () => {
  const notNullColumns = () =>
    Object.keys(BASE).flatMap((table) =>
      rows(raw, `PRAGMA table_info("${table}")`)
        .filter((c) => c.notnull && !c.pk)
        .map((c) => [table, String(c.name)] as const)
    );

  it('every NOT NULL column refuses an explicit NULL', () => {
    const accepted = notNullColumns().filter(([table, column]) => {
      try {
        insertCase(table, { [column]: null });
        return true;
      } catch (error) {
        expect((error as Error).message).toBe(`NOT NULL constraint failed: ${table}.${column}`);
        return false;
      }
    });
    expect(accepted).toEqual([]);
  });

  it('primary keys refuse NULL', () => {
    expect(() => insertCase('dhikrs', { id: null })).toThrow('NOT NULL constraint failed: dhikrs.id');
    expect(() => insertCase('app_settings', { key: null })).toThrow('NOT NULL constraint failed: app_settings.key');
    expect(() => insertCase('currencies', { code: null })).toThrow('NOT NULL constraint failed: currencies.code');
  });

  it('defaults apply when the column is omitted', () => {
    insertRow(raw, 'dhikrs', { id: uuid(3), name: 'Defaults', ...META });
    insertRow(raw, 'dhikr_sessions', {
      id: uuid(31), dhikr_id: uuid(3), entry_mode: 'counter', status: 'in_progress', started_at: T0,
      local_date: '2026-11-08', ...PARIS, ...META,
    });
    insertRow(raw, 'quran_readings', BASE.quran_readings);
    insertRow(raw, 'goal_reminders', BASE.goal_reminders);
    expect(scalar(raw, `SELECT sort_order FROM dhikrs WHERE id = ?`, [uuid(3)])).toBe(0);
    expect(scalar(raw, `SELECT count FROM dhikr_sessions WHERE id = ?`, [uuid(31)])).toBe(0);
    expect(scalar(raw, `SELECT mushaf FROM quran_readings`)).toBe('madinah_604');
    expect(rows(raw, `SELECT only_if_incomplete, is_enabled FROM goal_reminders`)).toEqual([
      { only_if_incomplete: 1, is_enabled: 1 },
    ]);
  });
});

describe('UNIQUE constraints and unique indexes', () => {
  const expectUnique = (fn: () => void, target: string) => expect(fn).toThrow(`UNIQUE constraint failed: ${target}`);

  it('primary keys', () => {
    expectUnique(() => insertCase('dhikrs', { id: DHIKR }), 'dhikrs.id');
    expectUnique(() => insertCase('currencies', { code: 'XAF' }), 'currencies.code');
    expectUnique(() => insertCase('quran_surahs', { number: 1 }), 'quran_surahs.number');
    insertCase('app_settings', {});
    expectUnique(() => insertCase('app_settings', {}), 'app_settings.key');
  });

  it('dhikrs_active_name: active names are unique without regard to ASCII case', () => {
    expectUnique(() => insertCase('dhikrs', { name: 'TEST DHIKR' }), 'dhikrs.name');
    insertCase('dhikrs', { name: 'test dhikr', archived_at: T0 });
    raw.run(`UPDATE dhikrs SET archived_at = ? WHERE id = ?`, [T0, DHIKR]);
    insertCase('dhikrs', { id: uuid(4), name: 'Test Dhikr' });
    expect(count(raw, 'dhikrs')).toBe(3);
  });

  it('dhikr_sessions_one_in_progress: a single session in progress', () => {
    insertCase('dhikr_sessions', {});
    expectUnique(() => insertCase('dhikr_sessions', { id: uuid(32) }), 'dhikr_sessions.status');
    insertCase('dhikr_sessions', { id: uuid(33), status: 'completed', count: 1, ended_at: T0 });
    insertCase('dhikr_sessions', { id: uuid(34), status: 'completed', count: 1, ended_at: T0 });
    expect(count(raw, 'dhikr_sessions')).toBe(3);
  });

  it('nights: one row per night date', () => {
    expectUnique(() => insertCase('nights', { night_date: '2026-11-07' }), 'nights.night_date');
  });

  it('night_prayer_units: one position per session', () => {
    insertCase('night_prayer_units', {});
    expectUnique(() => insertCase('night_prayer_units', { id: uuid(41) }), 'night_prayer_units.session_id, night_prayer_units.position');
  });

  it('fasts: one fast per local date', () => {
    insertCase('fasts', {});
    expectUnique(() => insertCase('fasts', { id: uuid(61), kind: 'other' }), 'fasts.local_date');
  });

  it('goal_versions_one_open: a goal never has two open versions', () => {
    expectUnique(
      () => insertRow(raw, 'goal_versions', { ...BASE.goal_versions, id: uuid(92), goal_id: SEED_GOAL, open_ref: uuid(92), effective_from: '2026-11-09' }),
      'goal_versions.goal_id'
    );
  });
});

describe('foreign keys', () => {
  const FK = 'FOREIGN KEY constraint failed';

  it('refuse unknown parents', () => {
    expect(() => insertCase('dhikr_sessions', { dhikr_id: uuid(999) })).toThrow(FK);
    expect(() => insertCase('quran_readings', { start_surah: 4, end_surah: 4 })).toThrow(FK);
    expect(() => insertCase('sadaqas', { currency: 'USD' })).toThrow(FK);
    expect(() => insertCase('goals', { dhikr_id: uuid(999) })).toThrow(FK);
    expect(() => insertCase('goals', { activity: 'sadaqa', metric: 'amount', currency: 'USD' })).toThrow(FK);
    expect(() => insertCase('goal_reminders', { goal_id: uuid(999) })).toThrow(FK);
  });

  it('a session must store the date of the night it references', () => {
    expect(() => insertCase('night_prayer_sessions', { night_id: NIGHT_7 })).toThrow(FK);
  });

  it('a prayer must reference its session and the night of that session', () => {
    expect(() => insertCase('night_prayer_units', { night_id: NIGHT_8 })).toThrow(FK);
    expect(() => insertCase('night_prayer_units', { session_id: uuid(999) })).toThrow(FK);
  });

  it('RESTRICT protects referenced rows', () => {
    insertCase('dhikr_sessions', {});
    insertCase('sadaqas', {});
    insertCase('quran_readings', { start_surah: 1, end_surah: 1 });
    expect(() => raw.run(`DELETE FROM dhikrs WHERE id = ?`, [DHIKR])).toThrow(FK);
    expect(() => raw.run(`DELETE FROM nights WHERE id = ?`, [NIGHT_7])).toThrow(FK);
    expect(() => raw.run(`DELETE FROM currencies WHERE code = 'XAF'`)).toThrow(FK);
    expect(() => raw.run(`DELETE FROM quran_surahs WHERE number = 1`)).toThrow(FK);
    insertCase('goal_reminders', {});
    expect(() => inTransaction(raw, () => raw.run(`DELETE FROM goals WHERE id = ?`, [SEED_GOAL]))).toThrow(FK);
    expect(count(raw, 'goals')).toBe(1);
  });

  it('deleting a session deletes its prayers, the only cascade of the model', () => {
    insertCase('night_prayer_units', {});
    insertCase('night_prayer_units', { id: uuid(41), position: 2, kind: 'qiyam', rakaat: 2 });
    raw.run(`DELETE FROM night_prayer_sessions WHERE id = ?`, [SESSION_7]);
    expect(count(raw, 'night_prayer_units')).toBe(0);
    raw.run(`DELETE FROM nights WHERE id = ?`, [NIGHT_7]);
    expect(count(raw, 'nights')).toBe(1);
  });

  it('a reading may name the same surah at both ends', () => {
    insertCase('quran_readings', { start_surah: 2, end_surah: 2, start_ayah: 1, end_ayah: 286 });
    expect(count(raw, 'quran_readings')).toBe(1);
  });
});

describe('foreign keys, each one alone', () => {
  const FK = 'FOREIGN KEY constraint failed';
  const ARCHIVED = uuid(85);
  const CLOSED_VERSION = uuid(86);

  /** An archived goal without any version or reminder: nothing else blocks its deletion. */
  const insertArchivedGoal = () => insertRow(raw, 'goals', { ...BASE.goals, id: ARCHIVED, ...ARCHIVED_GOAL, archived_at: T0 });
  const deleteArchivedGoal = () => raw.run(`DELETE FROM goals WHERE id = ?`, [ARCHIVED]);
  const archivedGoalCount = () => scalar(raw, `SELECT count(*) FROM goals WHERE id = ?`, [ARCHIVED]);

  it('quran_readings.start_surah alone refuses an unknown surah', () => {
    insertRow(raw, 'quran_surahs', { number: 5, ayah_count: 120 });
    expect(() => insertCase('quran_readings', { start_surah: 4, end_surah: 5 })).toThrow(FK);
    insertCase('quran_readings', { start_surah: 3, end_surah: 5 });
    expect(count(raw, 'quran_readings')).toBe(1);
  });

  it('quran_readings.end_surah alone refuses an unknown surah', () => {
    expect(() => insertCase('quran_readings', { start_surah: 1, end_surah: 4 })).toThrow(FK);
    insertCase('quran_readings', { start_surah: 1, end_surah: 3 });
    expect(count(raw, 'quran_readings')).toBe(1);
  });

  it('goals.dhikr_id: RESTRICT protects a dhikr referenced by a goal only', () => {
    insertCase('dhikrs', {});
    insertCase('goals', { dhikr_id: uuid(2) });
    expect(() => raw.run(`DELETE FROM dhikrs WHERE id = ?`, [uuid(2)])).toThrow(FK);
    expect(count(raw, 'dhikrs')).toBe(2);
    raw.run(`UPDATE goals SET dhikr_id = NULL WHERE id = ?`, [uuid(80)]);
    raw.run(`DELETE FROM dhikrs WHERE id = ?`, [uuid(2)]);
    expect(count(raw, 'dhikrs')).toBe(1);
  });

  it('goals.currency: RESTRICT protects a currency referenced by a goal only', () => {
    insertCase('currencies', {});
    insertCase('goals', { activity: 'sadaqa', metric: 'amount', currency: 'EUR' });
    expect(() => raw.run(`DELETE FROM currencies WHERE code = 'EUR'`)).toThrow(FK);
    expect(count(raw, 'currencies')).toBe(3);
    raw.run(`UPDATE goals SET currency = 'CAD' WHERE id = ?`, [uuid(80)]);
    raw.run(`DELETE FROM currencies WHERE code = 'EUR'`);
    expect(count(raw, 'currencies')).toBe(2);
  });

  it('goal_reminders.goal_id: RESTRICT protects a goal that has a reminder and no version', () => {
    insertArchivedGoal();
    insertCase('goal_reminders', { goal_id: ARCHIVED });
    expect(deleteArchivedGoal).toThrow(FK);
    expect(archivedGoalCount()).toBe(1);
    raw.run(`DELETE FROM goal_reminders WHERE goal_id = ?`, [ARCHIVED]);
    deleteArchivedGoal();
    expect(archivedGoalCount()).toBe(0);
  });

  it('goal_versions.goal_id: RESTRICT protects a goal that has a closed version and no reminder', () => {
    insertArchivedGoal();
    insertRow(raw, 'goal_versions', {
      ...BASE.goal_versions, id: CLOSED_VERSION, goal_id: ARCHIVED, effective_to: '2026-11-08', open_ref: null,
    });
    expect(deleteArchivedGoal).toThrow(FK);
    expect(archivedGoalCount()).toBe(1);
    raw.run(`DELETE FROM goal_versions WHERE id = ?`, [CLOSED_VERSION]);
    deleteArchivedGoal();
    expect(archivedGoalCount()).toBe(0);
  });

  it('RESTRICT acts at the statement, never deferred to COMMIT', () => {
    insertArchivedGoal();
    insertCase('goal_reminders', { goal_id: ARCHIVED });
    raw.exec('BEGIN');
    expect(deleteArchivedGoal).toThrow(FK);
    expect(archivedGoalCount()).toBe(1);
    raw.exec('ROLLBACK');
  });
});
