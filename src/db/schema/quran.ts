import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import {
  col,
  integerChecks,
  enumCheck,
  idCheck,
  idColumn,
  instantCheck,
  localDateOfInstantCheck,
  metadataChecks,
  metadataColumns,
  timeZoneChecks,
  timeZoneColumns,
} from './columns';
import { quranSurahs } from './reference';

export const MUSHAFS = ['madinah_604'] as const;
export const QURAN_MODES = ['reading', 'memorization', 'revision'] as const;

/**
 * One Quran reading. Pages are required. Surahs and ayahs are optional, given as complete start and
 * end pairs. The ayah bound of each surah is checked by triggers in 5.4.
 */
export const quranReadings = sqliteTable(
  'quran_readings',
  {
    ...idColumn(),
    mushaf: text('mushaf', { enum: MUSHAFS }).notNull().default('madinah_604'),
    mode: text('mode', { enum: QURAN_MODES }).notNull(),
    startPage: integer('start_page').notNull(),
    endPage: integer('end_page').notNull(),
    startSurah: integer('start_surah').references(() => quranSurahs.number, { onDelete: 'restrict' }),
    startAyah: integer('start_ayah'),
    endSurah: integer('end_surah').references(() => quranSurahs.number, { onDelete: 'restrict' }),
    endAyah: integer('end_ayah'),
    durationMin: integer('duration_min'),
    occurredAt: integer('occurred_at').notNull(),
    localDate: text('local_date').notNull(),
    ...timeZoneColumns(),
    note: text('note'),
    ...metadataColumns(),
  },
  (t) => [
    ...integerChecks('quran_readings', t),
    idCheck('quran_readings_id_check', t.id),
    enumCheck('quran_readings_mushaf_check', t.mushaf, MUSHAFS),
    enumCheck('quran_readings_mode_check', t.mode, QURAN_MODES),
    check('quran_readings_start_page_check', sql`${col(t.startPage)} BETWEEN 1 AND 604`),
    check('quran_readings_end_page_check', sql`${col(t.endPage)} BETWEEN ${col(t.startPage)} AND 604`),
    check('quran_readings_start_ayah_check', sql`${col(t.startAyah)} >= 1`),
    check('quran_readings_end_ayah_check', sql`${col(t.endAyah)} >= 1`),
    check('quran_readings_duration_check', sql`${col(t.durationMin)} BETWEEN 1 AND 1440`),
    instantCheck('quran_readings_occurred_at_check', t.occurredAt),
    localDateOfInstantCheck('quran_readings_local_date_check', t.localDate, t.occurredAt, t.utcOffsetMin),
    ...timeZoneChecks('quran_readings', t),
    ...metadataChecks('quran_readings', t),
    check(
      'quran_readings_surah_pair_check',
      sql`(${col(t.startSurah)} IS NULL) = (${col(t.endSurah)} IS NULL)`
    ),
    check('quran_readings_ayah_pair_check', sql`(${col(t.startAyah)} IS NULL) = (${col(t.endAyah)} IS NULL)`),
    check(
      'quran_readings_ayah_needs_surah_check',
      sql`${col(t.startAyah)} IS NULL OR ${col(t.startSurah)} IS NOT NULL`
    ),
    check(
      'quran_readings_range_order_check',
      sql`${col(t.endSurah)} IS NULL OR ${col(t.endSurah)} > ${col(t.startSurah)} OR (${col(t.endSurah)} = ${col(t.startSurah)} AND (${col(t.startAyah)} IS NULL OR ${col(t.endAyah)} >= ${col(t.startAyah)}))`
    ),
    index('quran_readings_by_date').on(t.localDate, t.mode),
  ]
);
