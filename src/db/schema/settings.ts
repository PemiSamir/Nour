import { sql } from 'drizzle-orm';
import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { col, integerChecks, metadataChecks, metadataColumns } from './columns';

/** Application settings, one JSON value per key. */
export const appSettings = sqliteTable(
  'app_settings',
  {
    key: text('key').primaryKey(),
    value: text('value').notNull(),
    ...metadataColumns(),
  },
  (t) => [
    ...integerChecks('app_settings', t),
    check('app_settings_key_check', sql`length(${col(t.key)}) BETWEEN 1 AND 100`),
    check('app_settings_value_check', sql`json_valid(${col(t.value)})`),
    ...metadataChecks('app_settings', t),
  ]
);
