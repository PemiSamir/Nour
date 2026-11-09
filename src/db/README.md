# NOUR database

Local SQLite database, defined with Drizzle ORM 0.45.4 and generated with drizzle-kit 0.31.11.

| Path | Content |
|---|---|
| `src/db/schema/` | Drizzle schema, one file per domain, `index.ts` exports the 14 tables |
| `drizzle.config.ts` | drizzle-kit configuration: SQLite dialect, `expo` driver, output in `drizzle/` |
| `drizzle/` | Generated migrations, journal, snapshots and `migrations.js` |
| `tests/db/` | Structure, constraint and guard tests, on sql.js with the Drizzle migrator |

Generate a migration with `npm run db:generate`. Never apply migrations with drizzle-kit: the app
runner (sub-step 5.5) applies them.

## Tables

The schema has exactly 14 tables: 12 business tables and 2 reference tables.

| Kind | Tables |
|---|---|
| Business | `app_settings`, `dhikrs`, `dhikr_sessions`, `nights`, `night_prayer_sessions`, `night_prayer_units`, `quran_readings`, `fasts`, `sadaqas`, `goals`, `goal_versions`, `goal_reminders` |
| Reference | `currencies`, `quran_surahs` |

The migrator adds its own journal table, `__drizzle_migrations`. It is not part of the model.

## Conventions

- Identifiers are 36-character UUID strings, except `app_settings.key`, `currencies.code` and `quran_surahs.number`.
- Instants are integer milliseconds UTC, bounded from 2000-01-01 to 2100-01-01.
- A local date is a frozen `YYYY-MM-DD` string, checked with `x IS date(x)`. Never `=`, which lets NULL through.
- Activities store their IANA time zone and `utc_offset_min`, from -720 to 840 in steps of 15. The value is `-Date.prototype.getTimezoneOffset()`.
- Amounts are integers in the minor unit of their currency, whose precision is in `currencies.minor_unit`.
- Every CHECK has a name, which is the one SQLite reports in its error message.
- Every INTEGER column holds a real integer, never a REAL such as `2.5`. See below.

### INTEGER columns hold integers only

The tables are not `STRICT`, so SQLite keeps a non-integral REAL such as `2.5` in an INTEGER column,
and some range CHECKs accept it: `60.5 % 15 = 0` is true because `%` truncates. Every INTEGER
column therefore has its own CHECK, named `<table>_<column>_integer`:

| Column | CHECK |
|---|---|
| NOT NULL | `typeof(x) = 'integer'` |
| Optional | `x IS NULL OR typeof(x) = 'integer'` |

- `integerChecks()` in `schema/columns.ts` adds them to every table, from the column list itself, so a new INTEGER column gets its CHECK without anything to remember. They come first in each table, so SQLite reports them before any range CHECK.
- 61 columns are covered: quantities, targets, positions, amounts in minor units, pages, surahs and ayahs, durations, minutes, flags, instants and UTC offsets.
- The INTEGER PRIMARY KEY `quran_surahs.number` has none. It is the rowid, and SQLite already refuses a non-integer with `datatype mismatch`.
- `typeof()` is read after SQLite has applied the column affinity. An integral REAL such as `2.0`, or a numeric text such as `'2'`, is stored and accepted as an integer. `'2.5'`, `'abc'` and blobs are refused.
- sql.js, used by the tests, binds JavaScript numbers beyond 32 bits, such as instants, as REAL. Affinity converts them back to integers, which the tests verify. The expo-sqlite binding is checked with the real connection, in 5.5.

### Documented exception: reference tables have no metadata

Every business table has `created_at` and `updated_at`, with `updated_at >= created_at`.
The reference tables `currencies` and `quran_surahs` deliberately have neither column.
Their rows are reference data, filled by a dedicated migration after sub-step 5.4. They are never
filled by `0000_init`.

## Manual patch: the two deferred foreign keys

### Why

An active goal has exactly one open version, and an archived goal has none. Two circular composite
foreign keys enforce this invariant when the transaction commits:

| Constraint in the schema | Foreign key |
|---|---|
| `goals_current_version_fk` | `goals(current_version_id, id)` references `goal_versions(open_ref, goal_id)` |
| `goal_versions_open_fk` | `goal_versions(goal_id, open_ref)` references `goals(id, current_version_id)` |

Creating, modifying, archiving and reactivating a goal each take several statements, and the
invariant is false between them. Both keys must therefore be `DEFERRABLE INITIALLY DEFERRED`.

### Drizzle limit

| Capability | Status |
|---|---|
| TypeScript schema | Expresses both circular composite keys. Has no option for deferrability: `foreignKey()` only offers `onUpdate` and `onDelete` |
| drizzle-kit generator | Never emits `DEFERRABLE`, and its snapshot has no field for it |
| SQLite engine | Applies both deferred keys correctly once the clause is in the SQL |

### The patch

After generation, and before any application or commit, exactly two lines of the migration receive
the clause. Each is preceded by the comment `-- NOUR manual patch: deferred circular foreign key`.

```sql
-- NOUR manual patch: deferred circular foreign key, see src/db/README.md
FOREIGN KEY (`goal_id`,`open_ref`) REFERENCES `goals`(`id`,`current_version_id`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
-- NOUR manual patch: deferred circular foreign key, see src/db/README.md
FOREIGN KEY (`current_version_id`,`id`) REFERENCES `goal_versions`(`open_ref`,`goal_id`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
```

drizzle-kit does not see the patch, since it compares snapshots and not SQL. Running
`npm run db:generate` again on an unchanged schema reports no change.

### Guard tests

`tests/db/goal-deferred-keys.test.ts` fails as soon as a migration loses the clause:

1. The SQL really applied, read from `sqlite_master`, holds exactly the two clauses, on the right keys.
2. A goal and its first version are created in one transaction.
3. An inconsistent state is refused at COMMIT.
4. The refused transaction is fully rolled back.
5. The connection remains usable after the rollback.

### Risk: any migration that recreates `goals` or `goal_versions`

Some schema changes make drizzle-kit recreate a table: `CREATE TABLE __new_goals`, copy, drop and
rename. The recreated table **has no deferred clause**, so the invariant is lost silently. This was
demonstrated with drizzle-kit 0.31.11.

Procedure for every new migration:

1. Search the generated SQL for `__new_goals` and `__new_goal_versions`.
2. If either is present, add ` DEFERRABLE INITIALLY DEFERRED` to the circular foreign key of each recreated table, with the same comment. Do this before applying or committing anything.
3. Run `npm test`. The guard tests fail until the clause is back.

## Whitespace normalization of `drizzle/migrations.js`

drizzle-kit 0.31.11 writes `drizzle/migrations.js` with a last line made of two spaces and no final
newline, which `git diff --check` reports. That trailing whitespace is removed and the file ends with
a single newline. Nothing else changes: same imports, same object, same indentation.

drizzle-kit rewrites this file at every generation, so the normalization must be redone after each
`npm run db:generate` that creates a migration.

## Other Drizzle limits

- **Qualified names in CHECK.** Drizzle renders `${t.column}` as `"table"."column"`. SQLite rejects that inside `CREATE TABLE __new_<table>`, so a future recreation would fail. The schema writes every CHECK and partial index with unqualified names, through `col()` in `schema/columns.ts`.
- **No bound values in CHECK.** drizzle-kit does not inline parameters. Constants are written as literal SQL with `lit()` and `inList()`.
- **Enumerations.** `text({ enum })` only constrains TypeScript. Every enumeration has an explicit CHECK.
- **Unique constraints.** drizzle-kit emits `unique()` as a separate `CREATE UNIQUE INDEX`, which is also a valid parent key for a foreign key.
- **Constraint names.** The names of foreign keys appear only in the snapshot, not in the SQL. A violated foreign key reports only `FOREIGN KEY constraint failed`.
- **Wrapped errors.** A failure at COMMIT reaches the caller as a `DrizzleError`, "Failed to run the query 'commit'". The SQLite message is in `error.cause`. Repositories must read it.
- **Migrations are applied by timestamp.** The migrator skips any migration dated before the last one applied, without an error. The journal test of 5.4 guards against it.
- **`PRAGMA foreign_keys=OFF` in a generated migration has no effect.** Each migration runs inside a transaction, where SQLite ignores this pragma. The 5.5 runner disables foreign keys at connection level before migrating.
- **`drizzle/migrations.js` imports `.sql` files.** Metro needs `babel-plugin-inline-import` for that, in 5.5. Until then, only the tests read `drizzle/`, through the Node migrator.
- **`INTEGER PRIMARY KEY`.** As in any SQLite table, inserting NULL into `quran_surahs.number` assigns the next row id. The reference data step must always give the number.
