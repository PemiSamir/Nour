import { sql } from 'drizzle-orm';
import { check, foreignKey, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

import {
  col,
  integerChecks,
  enumCheck,
  idCheck,
  idColumn,
  instantCheck,
  lit,
  localDateCheck,
  metadataChecks,
  metadataColumns,
  timeZoneChecks,
  timeZoneColumns,
} from './columns';

export const NIGHT_PRAYER_KINDS = ['qiyam', 'tahajjud', 'witr'] as const;

/** 12 hours, the longest night prayer session. */
const MAX_SESSION_MS = 43_200_000;

/** One night, identified by the local date on which it starts. */
export const nights = sqliteTable(
  'nights',
  {
    ...idColumn(),
    nightDate: text('night_date').notNull(),
    note: text('note'),
    ...metadataColumns(),
  },
  (t) => [
    ...integerChecks('nights', t),
    idCheck('nights_id_check', t.id),
    localDateCheck('nights_night_date_check', t.nightDate),
    ...metadataChecks('nights', t),
    unique('nights_night_date_unique').on(t.nightDate),
    // Parent key of the composite foreign key of night_prayer_sessions.
    unique('nights_id_night_date_unique').on(t.id, t.nightDate),
  ]
);

/**
 * One night prayer session. Only the start time decides the night: when it is known, the night
 * date is the start shifted by the UTC offset and by the night cutoff stored in `cutoff_min`.
 * Without a start time, the night is chosen explicitly. `recorded_at` is only a trace.
 */
export const nightPrayerSessions = sqliteTable(
  'night_prayer_sessions',
  {
    ...idColumn(),
    nightId: text('night_id').notNull(),
    nightDate: text('night_date').notNull(),
    startedAt: integer('started_at'),
    endedAt: integer('ended_at'),
    cutoffMin: integer('cutoff_min').notNull(),
    recordedAt: integer('recorded_at').notNull(),
    ...timeZoneColumns(),
    note: text('note'),
    ...metadataColumns(),
  },
  (t) => [
    ...integerChecks('night_prayer_sessions', t),
    idCheck('night_prayer_sessions_id_check', t.id),
    instantCheck('night_prayer_sessions_started_at_check', t.startedAt),
    check('night_prayer_sessions_cutoff_check', sql`${col(t.cutoffMin)} BETWEEN 0 AND 720`),
    instantCheck('night_prayer_sessions_recorded_at_check', t.recordedAt),
    ...timeZoneChecks('night_prayer_sessions', t),
    ...metadataChecks('night_prayer_sessions', t),
    foreignKey({
      name: 'night_prayer_sessions_night_fk',
      columns: [t.nightId, t.nightDate],
      foreignColumns: [nights.id, nights.nightDate],
    }).onDelete('restrict'),
    // Parent key of the composite foreign key of night_prayer_units.
    unique('night_prayer_sessions_id_night_unique').on(t.id, t.nightId),
    check(
      'night_prayer_sessions_end_needs_start_check',
      sql`${col(t.startedAt)} IS NOT NULL OR ${col(t.endedAt)} IS NULL`
    ),
    check(
      'night_prayer_sessions_duration_check',
      sql`${col(t.endedAt)} IS NULL OR ${col(t.endedAt)} BETWEEN ${col(t.startedAt)} AND ${col(t.startedAt)} + ${lit(MAX_SESSION_MS)}`
    ),
    check(
      'night_prayer_sessions_night_date_check',
      sql`${col(t.startedAt)} IS NULL OR ${col(t.nightDate)} IS date(${col(t.startedAt)} / 1000 + ${col(t.utcOffsetMin)} * 60 - ${col(t.cutoffMin)} * 60, 'unixepoch')`
    ),
    index('night_prayer_sessions_by_night').on(t.nightId),
  ]
);

/** Prayers of a session. The only cascading foreign key of the model. */
export const nightPrayerUnits = sqliteTable(
  'night_prayer_units',
  {
    ...idColumn(),
    sessionId: text('session_id').notNull(),
    nightId: text('night_id').notNull(),
    kind: text('kind', { enum: NIGHT_PRAYER_KINDS }).notNull(),
    rakaat: integer('rakaat').notNull(),
    position: integer('position').notNull(),
    ...metadataColumns(),
  },
  (t) => [
    ...integerChecks('night_prayer_units', t),
    idCheck('night_prayer_units_id_check', t.id),
    enumCheck('night_prayer_units_kind_check', t.kind, NIGHT_PRAYER_KINDS),
    check('night_prayer_units_rakaat_check', sql`${col(t.rakaat)} BETWEEN 1 AND 99`),
    check('night_prayer_units_position_check', sql`${col(t.position)} >= 1`),
    ...metadataChecks('night_prayer_units', t),
    foreignKey({
      name: 'night_prayer_units_session_fk',
      columns: [t.sessionId, t.nightId],
      foreignColumns: [nightPrayerSessions.id, nightPrayerSessions.nightId],
    }).onDelete('cascade'),
    unique('night_prayer_units_session_position_unique').on(t.sessionId, t.position),
    index('night_prayer_units_by_night').on(t.nightId, t.kind),
  ]
);
