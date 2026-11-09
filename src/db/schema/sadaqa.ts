import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import {
  MAX_QUANTITY,
  col,
  enumCheck,
  idCheck,
  idColumn,
  integerChecks,
  instantCheck,
  lit,
  localDateOfInstantCheck,
  metadataChecks,
  metadataColumns,
  timeZoneChecks,
  timeZoneColumns,
} from './columns';
import { currencies } from './reference';

export const SADAQA_KINDS = ['money', 'in_kind', 'time', 'other'] as const;

/**
 * One sadaqa. An amount is an integer in the minor unit of its currency, whose precision comes from
 * the `currencies` reference table.
 */
export const sadaqas = sqliteTable(
  'sadaqas',
  {
    ...idColumn(),
    kind: text('kind', { enum: SADAQA_KINDS }).notNull(),
    amountMinor: integer('amount_minor'),
    currency: text('currency').references(() => currencies.code, { onDelete: 'restrict' }),
    description: text('description'),
    occurredAt: integer('occurred_at').notNull(),
    localDate: text('local_date').notNull(),
    ...timeZoneColumns(),
    note: text('note'),
    ...metadataColumns(),
  },
  (t) => [
    ...integerChecks('sadaqas', t),
    idCheck('sadaqas_id_check', t.id),
    enumCheck('sadaqas_kind_check', t.kind, SADAQA_KINDS),
    check('sadaqas_amount_check', sql`${col(t.amountMinor)} BETWEEN 1 AND ${lit(MAX_QUANTITY)}`),
    instantCheck('sadaqas_occurred_at_check', t.occurredAt),
    localDateOfInstantCheck('sadaqas_local_date_check', t.localDate, t.occurredAt, t.utcOffsetMin),
    ...timeZoneChecks('sadaqas', t),
    ...metadataChecks('sadaqas', t),
    check(
      'sadaqas_amount_currency_check',
      sql`(${col(t.amountMinor)} IS NULL) = (${col(t.currency)} IS NULL)`
    ),
    check('sadaqas_money_amount_check', sql`${col(t.kind)} <> 'money' OR ${col(t.amountMinor)} IS NOT NULL`),
    index('sadaqas_by_date').on(t.localDate),
    index('sadaqas_by_currency').on(t.currency, t.localDate),
  ]
);
