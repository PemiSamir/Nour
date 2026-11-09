/**
 * Goals, their append-only versions and their reminders.
 *
 * Invariant: an active goal has exactly one open version, an archived goal has none. It is enforced
 * at COMMIT by two circular composite foreign keys:
 * - goals(current_version_id, id) -> goal_versions(open_ref, goal_id);
 * - goal_versions(goal_id, open_ref) -> goals(id, current_version_id).
 *
 * Both MUST be `DEFERRABLE INITIALLY DEFERRED`: creating, modifying, archiving or reactivating a goal
 * always takes several statements, and the invariant is false between them. Drizzle 0.45.4 cannot
 * express that clause and drizzle-kit 0.31.11 never emits it, so it is added by hand to the generated
 * SQL. See src/db/README.md before generating any migration that recreates these tables.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  type AnySQLiteColumn,
  type SQLiteTableExtraConfigValue,
  unique,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

import type { GoalPeriod } from '../../lib/calendar/periods';
import {
  MAX_QUANTITY,
  col,
  enumCheck,
  idCheck,
  idColumn,
  integerChecks,
  lit,
  metadataChecks,
  metadataColumns,
} from './columns';
import { dhikrs } from './dhikr';
import { NIGHT_PRAYER_KINDS } from './night-prayer';
import { QURAN_MODES } from './quran';
import { currencies } from './reference';

export const GOAL_ACTIVITIES = ['dhikr', 'night_prayer', 'quran', 'fasting', 'sadaqa'] as const;
export const GOAL_METRICS = [
  'repetitions',
  'sessions',
  'rakaat',
  'nights',
  'pages',
  'minutes',
  'days',
  'occurrences',
  'amount',
] as const;
export const GOAL_STATUSES = ['active', 'archived'] as const;
export const GOAL_VERSION_PERIODS = ['daily', 'weekly', 'monthly', 'yearly'] as const satisfies readonly GoalPeriod[];
export const GOAL_REMINDER_KINDS = ['fixed_time', 'before_period_end'] as const;

/** What a goal measures. Its identity is frozen and its target lives in its versions. */
export const goals = sqliteTable(
  'goals',
  {
    ...idColumn(),
    title: text('title').notNull(),
    activity: text('activity', { enum: GOAL_ACTIVITIES }).notNull(),
    metric: text('metric', { enum: GOAL_METRICS }).notNull(),
    dhikrId: text('dhikr_id').references(() => dhikrs.id, { onDelete: 'restrict' }),
    nightPrayerKind: text('night_prayer_kind', { enum: NIGHT_PRAYER_KINDS }),
    quranMode: text('quran_mode', { enum: QURAN_MODES }),
    currency: text('currency').references(() => currencies.code, { onDelete: 'restrict' }),
    status: text('status', { enum: GOAL_STATUSES }).notNull(),
    archivedAt: integer('archived_at'),
    currentVersionId: text('current_version_id'),
    ...metadataColumns(),
  },
  (t): SQLiteTableExtraConfigValue[] => [
    ...integerChecks('goals', t),
    idCheck('goals_id_check', t.id),
    check('goals_title_check', sql`length(trim(${col(t.title)})) BETWEEN 1 AND 120`),
    enumCheck('goals_activity_check', t.activity, GOAL_ACTIVITIES),
    enumCheck('goals_night_prayer_kind_check', t.nightPrayerKind, NIGHT_PRAYER_KINDS),
    enumCheck('goals_quran_mode_check', t.quranMode, QURAN_MODES),
    enumCheck('goals_status_check', t.status, GOAL_STATUSES),
    ...metadataChecks('goals', t),
    check(
      'goals_metric_check',
      sql`(${col(t.activity)} = 'dhikr' AND ${col(t.metric)} IN ('repetitions', 'sessions'))
        OR (${col(t.activity)} = 'night_prayer' AND ${col(t.metric)} IN ('rakaat', 'nights'))
        OR (${col(t.activity)} = 'quran' AND ${col(t.metric)} IN ('pages', 'minutes'))
        OR (${col(t.activity)} = 'fasting' AND ${col(t.metric)} = 'days')
        OR (${col(t.activity)} = 'sadaqa' AND ${col(t.metric)} IN ('occurrences', 'amount'))`
    ),
    check('goals_dhikr_filter_check', sql`${col(t.dhikrId)} IS NULL OR ${col(t.activity)} = 'dhikr'`),
    check(
      'goals_night_prayer_filter_check',
      sql`${col(t.nightPrayerKind)} IS NULL OR ${col(t.activity)} = 'night_prayer'`
    ),
    check('goals_quran_filter_check', sql`${col(t.quranMode)} IS NULL OR ${col(t.activity)} = 'quran'`),
    check('goals_currency_check', sql`(${col(t.metric)} = 'amount') = (${col(t.currency)} IS NOT NULL)`),
    check('goals_archived_check', sql`(${col(t.status)} = 'archived') = (${col(t.archivedAt)} IS NOT NULL)`),
    check(
      'goals_archived_at_check',
      sql`${col(t.archivedAt)} IS NULL OR ${col(t.archivedAt)} >= ${col(t.createdAt)}`
    ),
    check(
      'goals_current_version_check',
      sql`(${col(t.status)} = 'active') = (${col(t.currentVersionId)} IS NOT NULL)`
    ),
    // Parent key of goal_versions_open_fk.
    unique('goals_id_current_version_unique').on(t.id, t.currentVersionId),
    // Hand-patched to DEFERRABLE INITIALLY DEFERRED in the generated SQL.
    foreignKey({
      name: 'goals_current_version_fk',
      columns: [t.currentVersionId, t.id],
      foreignColumns: [goalVersions.openRef, goalVersions.goalId],
    }),
  ]
);

/** Append-only versions of a goal, aligned on the bounds of their period. */
export const goalVersions = sqliteTable(
  'goal_versions',
  {
    ...idColumn(),
    goalId: text('goal_id')
      .notNull()
      .references((): AnySQLiteColumn => goals.id, { onDelete: 'restrict' }),
    period: text('period', { enum: GOAL_VERSION_PERIODS }).notNull(),
    targetValue: integer('target_value').notNull(),
    effectiveFrom: text('effective_from').notNull(),
    effectiveTo: text('effective_to'),
    // Equals the version id while the version is open, NULL once it is closed.
    openRef: text('open_ref'),
    changeReason: text('change_reason'),
    ...metadataColumns(),
  },
  (t): SQLiteTableExtraConfigValue[] => [
    ...integerChecks('goal_versions', t),
    idCheck('goal_versions_id_check', t.id),
    enumCheck('goal_versions_period_check', t.period, GOAL_VERSION_PERIODS),
    check('goal_versions_target_check', sql`${col(t.targetValue)} BETWEEN 1 AND ${lit(MAX_QUANTITY)}`),
    check('goal_versions_from_check', sql`${col(t.effectiveFrom)} IS date(${col(t.effectiveFrom)})`),
    check(
      'goal_versions_to_check',
      sql`${col(t.effectiveTo)} IS NULL OR (${col(t.effectiveTo)} IS date(${col(t.effectiveTo)}) AND ${col(t.effectiveTo)} >= ${col(t.effectiveFrom)})`
    ),
    ...metadataChecks('goal_versions', t),
    check(
      'goal_versions_open_ref_check',
      sql`${col(t.openRef)} IS (CASE WHEN ${col(t.effectiveTo)} IS NULL THEN ${col(t.id)} END)`
    ),
    check(
      'goal_versions_start_aligned_check',
      sql`${col(t.period)} = 'daily'
        OR (${col(t.period)} = 'weekly' AND strftime('%w', ${col(t.effectiveFrom)}) = '1')
        OR (${col(t.period)} = 'monthly' AND strftime('%d', ${col(t.effectiveFrom)}) = '01')
        OR (${col(t.period)} = 'yearly' AND strftime('%m-%d', ${col(t.effectiveFrom)}) = '01-01')`
    ),
    check(
      'goal_versions_end_aligned_check',
      sql`${col(t.effectiveTo)} IS NULL OR ${col(t.period)} = 'daily'
        OR (${col(t.period)} = 'weekly' AND strftime('%w', ${col(t.effectiveTo)}) = '0')
        OR (${col(t.period)} = 'monthly' AND ${col(t.effectiveTo)} IS date(${col(t.effectiveTo)}, 'start of month', '+1 month', '-1 day'))
        OR (${col(t.period)} = 'yearly' AND strftime('%m-%d', ${col(t.effectiveTo)}) = '12-31')`
    ),
    // Parent key of goals_current_version_fk.
    unique('goal_versions_open_ref_goal_unique').on(t.openRef, t.goalId),
    // Hand-patched to DEFERRABLE INITIALLY DEFERRED in the generated SQL.
    foreignKey({
      name: 'goal_versions_open_fk',
      columns: [t.goalId, t.openRef],
      foreignColumns: [goals.id, goals.currentVersionId],
    }),
    uniqueIndex('goal_versions_one_open')
      .on(t.goalId)
      .where(sql`${col(t.effectiveTo)} IS NULL`),
    index('goal_versions_by_goal').on(t.goalId, t.effectiveFrom),
  ]
);

/** Reminders of a goal. Disabled by archiving, re-enabled only by the user (triggers in 5.4). */
export const goalReminders = sqliteTable(
  'goal_reminders',
  {
    ...idColumn(),
    goalId: text('goal_id')
      .notNull()
      .references((): AnySQLiteColumn => goals.id, { onDelete: 'restrict' }),
    kind: text('kind', { enum: GOAL_REMINDER_KINDS }).notNull(),
    timeOfDayMin: integer('time_of_day_min'),
    // Bit 0 is Monday.
    weekdaysMask: integer('weekdays_mask'),
    // Up to 366 days.
    leadMinutes: integer('lead_minutes'),
    onlyIfIncomplete: integer('only_if_incomplete').notNull().default(1),
    isEnabled: integer('is_enabled').notNull().default(1),
    message: text('message'),
    ...metadataColumns(),
  },
  (t): SQLiteTableExtraConfigValue[] => [
    ...integerChecks('goal_reminders', t),
    idCheck('goal_reminders_id_check', t.id),
    enumCheck('goal_reminders_kind_check', t.kind, GOAL_REMINDER_KINDS),
    check('goal_reminders_time_of_day_check', sql`${col(t.timeOfDayMin)} BETWEEN 0 AND 1439`),
    check('goal_reminders_weekdays_check', sql`${col(t.weekdaysMask)} BETWEEN 1 AND 127`),
    check('goal_reminders_lead_check', sql`${col(t.leadMinutes)} BETWEEN 1 AND 527040`),
    check('goal_reminders_only_if_incomplete_check', sql`${col(t.onlyIfIncomplete)} IN (0, 1)`),
    check('goal_reminders_is_enabled_check', sql`${col(t.isEnabled)} IN (0, 1)`),
    check(
      'goal_reminders_message_check',
      sql`${col(t.message)} IS NULL OR length(${col(t.message)}) <= 200`
    ),
    ...metadataChecks('goal_reminders', t),
    check(
      'goal_reminders_fixed_time_check',
      sql`(${col(t.kind)} = 'fixed_time') = (${col(t.timeOfDayMin)} IS NOT NULL)`
    ),
    check(
      'goal_reminders_weekdays_kind_check',
      sql`${col(t.kind)} = 'fixed_time' OR ${col(t.weekdaysMask)} IS NULL`
    ),
    check(
      'goal_reminders_lead_kind_check',
      sql`(${col(t.kind)} = 'before_period_end') = (${col(t.leadMinutes)} IS NOT NULL)`
    ),
    index('goal_reminders_by_goal')
      .on(t.goalId)
      .where(sql`${col(t.isEnabled)} = 1`),
  ]
);
