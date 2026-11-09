import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

export const DHIKR_ENTRY_MODES = ['counter', 'manual'] as const;
export const DHIKR_SESSION_STATUSES = ['in_progress', 'completed', 'abandoned'] as const;

/** Catalog of dhikrs. Archived, never deleted, while sessions reference them. */
export const dhikrs = sqliteTable(
  'dhikrs',
  {
    ...idColumn(),
    name: text('name').notNull(),
    arabicText: text('arabic_text'),
    transliteration: text('transliteration'),
    translation: text('translation'),
    defaultTarget: integer('default_target'),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: integer('archived_at'),
    ...metadataColumns(),
  },
  (t) => [
    ...integerChecks('dhikrs', t),
    idCheck('dhikrs_id_check', t.id),
    check('dhikrs_name_check', sql`length(trim(${col(t.name)})) BETWEEN 1 AND 120`),
    check('dhikrs_default_target_check', sql`${col(t.defaultTarget)} > 0`),
    check(
      'dhikrs_archived_at_check',
      sql`${col(t.archivedAt)} IS NULL OR ${col(t.archivedAt)} >= ${col(t.createdAt)}`
    ),
    ...metadataChecks('dhikrs', t),
    // Case-insensitive for ASCII letters only, as SQLite's NOCASE.
    uniqueIndex('dhikrs_active_name')
      .on(sql`${col(t.name)} COLLATE NOCASE`)
      .where(sql`${col(t.archivedAt)} IS NULL`),
  ]
);

/** One dhikr session, counted live or entered manually. */
export const dhikrSessions = sqliteTable(
  'dhikr_sessions',
  {
    ...idColumn(),
    dhikrId: text('dhikr_id')
      .notNull()
      .references(() => dhikrs.id, { onDelete: 'restrict' }),
    entryMode: text('entry_mode', { enum: DHIKR_ENTRY_MODES }).notNull(),
    status: text('status', { enum: DHIKR_SESSION_STATUSES }).notNull(),
    count: integer('count').notNull().default(0),
    targetCount: integer('target_count'),
    startedAt: integer('started_at').notNull(),
    lastCountedAt: integer('last_counted_at'),
    endedAt: integer('ended_at'),
    localDate: text('local_date').notNull(),
    ...timeZoneColumns(),
    note: text('note'),
    ...metadataColumns(),
  },
  (t) => [
    ...integerChecks('dhikr_sessions', t),
    idCheck('dhikr_sessions_id_check', t.id),
    enumCheck('dhikr_sessions_entry_mode_check', t.entryMode, DHIKR_ENTRY_MODES),
    enumCheck('dhikr_sessions_status_check', t.status, DHIKR_SESSION_STATUSES),
    check('dhikr_sessions_count_check', sql`${col(t.count)} >= 0`),
    check('dhikr_sessions_target_count_check', sql`${col(t.targetCount)} > 0`),
    instantCheck('dhikr_sessions_started_at_check', t.startedAt),
    check(
      'dhikr_sessions_last_counted_at_check',
      sql`${col(t.lastCountedAt)} IS NULL OR ${col(t.lastCountedAt)} >= ${col(t.startedAt)}`
    ),
    check(
      'dhikr_sessions_ended_at_check',
      sql`${col(t.endedAt)} IS NULL OR ${col(t.endedAt)} >= ${col(t.startedAt)}`
    ),
    localDateOfInstantCheck('dhikr_sessions_local_date_check', t.localDate, t.startedAt, t.utcOffsetMin),
    ...timeZoneChecks('dhikr_sessions', t),
    ...metadataChecks('dhikr_sessions', t),
    check(
      'dhikr_sessions_open_check',
      sql`(${col(t.status)} = 'in_progress') = (${col(t.endedAt)} IS NULL)`
    ),
    check(
      'dhikr_sessions_manual_check',
      sql`${col(t.entryMode)} = 'counter' OR ${col(t.status)} = 'completed'`
    ),
    check(
      'dhikr_sessions_completed_count_check',
      sql`${col(t.status)} <> 'completed' OR ${col(t.count)} > 0`
    ),
    uniqueIndex('dhikr_sessions_one_in_progress')
      .on(t.status)
      .where(sql`${col(t.status)} = 'in_progress'`),
    index('dhikr_sessions_by_date').on(t.localDate, t.status),
    index('dhikr_sessions_by_dhikr').on(t.dhikrId, t.localDate),
  ]
);
