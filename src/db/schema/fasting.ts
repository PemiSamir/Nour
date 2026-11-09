import { index, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

import {
  enumCheck,
  idCheck,
  idColumn,
  integerChecks,
  localDateCheck,
  metadataChecks,
  metadataColumns,
  timeZoneCheck,
} from './columns';

/** Validated list of voluntary fast kinds. Entered manually, no automatic Hijri calendar. */
export const FAST_KINDS = [
  'monday',
  'thursday',
  'white_days',
  'arafah',
  'ashura',
  'tasua',
  'shawwal',
  'dawud',
  'other',
] as const;
export const FAST_STATUSES = ['planned', 'completed', 'broken'] as const;

/** One voluntary fast per local date. A fast covers a whole day, so it keeps only its time zone. */
export const fasts = sqliteTable(
  'fasts',
  {
    ...idColumn(),
    localDate: text('local_date').notNull(),
    kind: text('kind', { enum: FAST_KINDS }).notNull(),
    status: text('status', { enum: FAST_STATUSES }).notNull(),
    timeZone: text('time_zone').notNull(),
    note: text('note'),
    ...metadataColumns(),
  },
  (t) => [
    ...integerChecks('fasts', t),
    idCheck('fasts_id_check', t.id),
    localDateCheck('fasts_local_date_check', t.localDate),
    enumCheck('fasts_kind_check', t.kind, FAST_KINDS),
    enumCheck('fasts_status_check', t.status, FAST_STATUSES),
    timeZoneCheck('fasts_time_zone_check', t.timeZone),
    ...metadataChecks('fasts', t),
    unique('fasts_local_date_unique').on(t.localDate),
    index('fasts_by_status').on(t.status, t.localDate),
  ]
);
