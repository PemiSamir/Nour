/**
 * Reference tables. Their rows are filled by a dedicated migration after sub-step 5.4, never by
 * `0000_init`.
 *
 * Documented exception: reference tables have no `created_at` / `updated_at`, unlike every
 * business table.
 */
import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { col, integerChecks } from './columns';

/** ISO 4217 currencies and their number of decimals. `minor_unit` is frozen once used (5.4). */
export const currencies = sqliteTable(
  'currencies',
  {
    code: text('code').primaryKey(),
    minorUnit: integer('minor_unit').notNull(),
  },
  (t) => [
    ...integerChecks('currencies', t),
    check('currencies_code_check', sql`${col(t.code)} GLOB '[A-Z][A-Z][A-Z]'`),
    check('currencies_minor_unit_check', sql`${col(t.minorUnit)} BETWEEN 0 AND 4`),
  ]
);

/** Number of ayahs of each surah, used to validate reading ranges (5.4). */
export const quranSurahs = sqliteTable(
  'quran_surahs',
  {
    number: integer('number').primaryKey(),
    ayahCount: integer('ayah_count').notNull(),
  },
  (t) => [
    ...integerChecks('quran_surahs', t),
    check('quran_surahs_number_check', sql`${col(t.number)} BETWEEN 1 AND 114`),
    check('quran_surahs_ayah_count_check', sql`${col(t.ayahCount)} BETWEEN 3 AND 286`),
  ]
);
