CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "app_settings_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "app_settings_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "app_settings_key_check" CHECK(length("key") BETWEEN 1 AND 100),
	CONSTRAINT "app_settings_value_check" CHECK(json_valid("value")),
	CONSTRAINT "app_settings_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "app_settings_updated_at_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE `currencies` (
	`code` text PRIMARY KEY NOT NULL,
	`minor_unit` integer NOT NULL,
	CONSTRAINT "currencies_minor_unit_integer" CHECK(typeof("minor_unit") = 'integer'),
	CONSTRAINT "currencies_code_check" CHECK("code" GLOB '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "currencies_minor_unit_check" CHECK("minor_unit" BETWEEN 0 AND 4)
);
--> statement-breakpoint
CREATE TABLE `dhikr_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`dhikr_id` text NOT NULL,
	`entry_mode` text NOT NULL,
	`status` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`target_count` integer,
	`started_at` integer NOT NULL,
	`last_counted_at` integer,
	`ended_at` integer,
	`local_date` text NOT NULL,
	`time_zone` text NOT NULL,
	`utc_offset_min` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`dhikr_id`) REFERENCES `dhikrs`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "dhikr_sessions_count_integer" CHECK(typeof("count") = 'integer'),
	CONSTRAINT "dhikr_sessions_target_count_integer" CHECK("target_count" IS NULL OR typeof("target_count") = 'integer'),
	CONSTRAINT "dhikr_sessions_started_at_integer" CHECK(typeof("started_at") = 'integer'),
	CONSTRAINT "dhikr_sessions_last_counted_at_integer" CHECK("last_counted_at" IS NULL OR typeof("last_counted_at") = 'integer'),
	CONSTRAINT "dhikr_sessions_ended_at_integer" CHECK("ended_at" IS NULL OR typeof("ended_at") = 'integer'),
	CONSTRAINT "dhikr_sessions_utc_offset_min_integer" CHECK(typeof("utc_offset_min") = 'integer'),
	CONSTRAINT "dhikr_sessions_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "dhikr_sessions_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "dhikr_sessions_id_check" CHECK(length("id") = 36),
	CONSTRAINT "dhikr_sessions_entry_mode_check" CHECK("entry_mode" IN ('counter', 'manual')),
	CONSTRAINT "dhikr_sessions_status_check" CHECK("status" IN ('in_progress', 'completed', 'abandoned')),
	CONSTRAINT "dhikr_sessions_count_check" CHECK("count" >= 0),
	CONSTRAINT "dhikr_sessions_target_count_check" CHECK("target_count" > 0),
	CONSTRAINT "dhikr_sessions_started_at_check" CHECK("started_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "dhikr_sessions_last_counted_at_check" CHECK("last_counted_at" IS NULL OR "last_counted_at" >= "started_at"),
	CONSTRAINT "dhikr_sessions_ended_at_check" CHECK("ended_at" IS NULL OR "ended_at" >= "started_at"),
	CONSTRAINT "dhikr_sessions_local_date_check" CHECK("local_date" IS date("started_at" / 1000 + "utc_offset_min" * 60, 'unixepoch')),
	CONSTRAINT "dhikr_sessions_time_zone_check" CHECK(length("time_zone") BETWEEN 1 AND 64),
	CONSTRAINT "dhikr_sessions_utc_offset_check" CHECK("utc_offset_min" BETWEEN -720 AND 840 AND "utc_offset_min" % 15 = 0),
	CONSTRAINT "dhikr_sessions_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "dhikr_sessions_updated_at_check" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "dhikr_sessions_open_check" CHECK(("status" = 'in_progress') = ("ended_at" IS NULL)),
	CONSTRAINT "dhikr_sessions_manual_check" CHECK("entry_mode" = 'counter' OR "status" = 'completed'),
	CONSTRAINT "dhikr_sessions_completed_count_check" CHECK("status" <> 'completed' OR "count" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dhikr_sessions_one_in_progress` ON `dhikr_sessions` (`status`) WHERE "status" = 'in_progress';--> statement-breakpoint
CREATE INDEX `dhikr_sessions_by_date` ON `dhikr_sessions` (`local_date`,`status`);--> statement-breakpoint
CREATE INDEX `dhikr_sessions_by_dhikr` ON `dhikr_sessions` (`dhikr_id`,`local_date`);--> statement-breakpoint
CREATE TABLE `dhikrs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`arabic_text` text,
	`transliteration` text,
	`translation` text,
	`default_target` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "dhikrs_default_target_integer" CHECK("default_target" IS NULL OR typeof("default_target") = 'integer'),
	CONSTRAINT "dhikrs_sort_order_integer" CHECK(typeof("sort_order") = 'integer'),
	CONSTRAINT "dhikrs_archived_at_integer" CHECK("archived_at" IS NULL OR typeof("archived_at") = 'integer'),
	CONSTRAINT "dhikrs_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "dhikrs_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "dhikrs_id_check" CHECK(length("id") = 36),
	CONSTRAINT "dhikrs_name_check" CHECK(length(trim("name")) BETWEEN 1 AND 120),
	CONSTRAINT "dhikrs_default_target_check" CHECK("default_target" > 0),
	CONSTRAINT "dhikrs_archived_at_check" CHECK("archived_at" IS NULL OR "archived_at" >= "created_at"),
	CONSTRAINT "dhikrs_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "dhikrs_updated_at_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dhikrs_active_name` ON `dhikrs` ("name" COLLATE NOCASE) WHERE "archived_at" IS NULL;--> statement-breakpoint
CREATE TABLE `fasts` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`time_zone` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "fasts_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "fasts_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "fasts_id_check" CHECK(length("id") = 36),
	CONSTRAINT "fasts_local_date_check" CHECK("local_date" IS date("local_date")),
	CONSTRAINT "fasts_kind_check" CHECK("kind" IN ('monday', 'thursday', 'white_days', 'arafah', 'ashura', 'tasua', 'shawwal', 'dawud', 'other')),
	CONSTRAINT "fasts_status_check" CHECK("status" IN ('planned', 'completed', 'broken')),
	CONSTRAINT "fasts_time_zone_check" CHECK(length("time_zone") BETWEEN 1 AND 64),
	CONSTRAINT "fasts_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "fasts_updated_at_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE INDEX `fasts_by_status` ON `fasts` (`status`,`local_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `fasts_local_date_unique` ON `fasts` (`local_date`);--> statement-breakpoint
CREATE TABLE `goal_reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`kind` text NOT NULL,
	`time_of_day_min` integer,
	`weekdays_mask` integer,
	`lead_minutes` integer,
	`only_if_incomplete` integer DEFAULT 1 NOT NULL,
	`is_enabled` integer DEFAULT 1 NOT NULL,
	`message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "goal_reminders_time_of_day_min_integer" CHECK("time_of_day_min" IS NULL OR typeof("time_of_day_min") = 'integer'),
	CONSTRAINT "goal_reminders_weekdays_mask_integer" CHECK("weekdays_mask" IS NULL OR typeof("weekdays_mask") = 'integer'),
	CONSTRAINT "goal_reminders_lead_minutes_integer" CHECK("lead_minutes" IS NULL OR typeof("lead_minutes") = 'integer'),
	CONSTRAINT "goal_reminders_only_if_incomplete_integer" CHECK(typeof("only_if_incomplete") = 'integer'),
	CONSTRAINT "goal_reminders_is_enabled_integer" CHECK(typeof("is_enabled") = 'integer'),
	CONSTRAINT "goal_reminders_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "goal_reminders_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "goal_reminders_id_check" CHECK(length("id") = 36),
	CONSTRAINT "goal_reminders_kind_check" CHECK("kind" IN ('fixed_time', 'before_period_end')),
	CONSTRAINT "goal_reminders_time_of_day_check" CHECK("time_of_day_min" BETWEEN 0 AND 1439),
	CONSTRAINT "goal_reminders_weekdays_check" CHECK("weekdays_mask" BETWEEN 1 AND 127),
	CONSTRAINT "goal_reminders_lead_check" CHECK("lead_minutes" BETWEEN 1 AND 527040),
	CONSTRAINT "goal_reminders_only_if_incomplete_check" CHECK("only_if_incomplete" IN (0, 1)),
	CONSTRAINT "goal_reminders_is_enabled_check" CHECK("is_enabled" IN (0, 1)),
	CONSTRAINT "goal_reminders_message_check" CHECK("message" IS NULL OR length("message") <= 200),
	CONSTRAINT "goal_reminders_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "goal_reminders_updated_at_check" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "goal_reminders_fixed_time_check" CHECK(("kind" = 'fixed_time') = ("time_of_day_min" IS NOT NULL)),
	CONSTRAINT "goal_reminders_weekdays_kind_check" CHECK("kind" = 'fixed_time' OR "weekdays_mask" IS NULL),
	CONSTRAINT "goal_reminders_lead_kind_check" CHECK(("kind" = 'before_period_end') = ("lead_minutes" IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX `goal_reminders_by_goal` ON `goal_reminders` (`goal_id`) WHERE "is_enabled" = 1;--> statement-breakpoint
CREATE TABLE `goal_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`period` text NOT NULL,
	`target_value` integer NOT NULL,
	`effective_from` text NOT NULL,
	`effective_to` text,
	`open_ref` text,
	`change_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE restrict,
	-- NOUR manual patch: deferred circular foreign key, see src/db/README.md
	FOREIGN KEY (`goal_id`,`open_ref`) REFERENCES `goals`(`id`,`current_version_id`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "goal_versions_target_value_integer" CHECK(typeof("target_value") = 'integer'),
	CONSTRAINT "goal_versions_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "goal_versions_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "goal_versions_id_check" CHECK(length("id") = 36),
	CONSTRAINT "goal_versions_period_check" CHECK("period" IN ('daily', 'weekly', 'monthly', 'yearly')),
	CONSTRAINT "goal_versions_target_check" CHECK("target_value" BETWEEN 1 AND 999999999999999),
	CONSTRAINT "goal_versions_from_check" CHECK("effective_from" IS date("effective_from")),
	CONSTRAINT "goal_versions_to_check" CHECK("effective_to" IS NULL OR ("effective_to" IS date("effective_to") AND "effective_to" >= "effective_from")),
	CONSTRAINT "goal_versions_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "goal_versions_updated_at_check" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "goal_versions_open_ref_check" CHECK("open_ref" IS (CASE WHEN "effective_to" IS NULL THEN "id" END)),
	CONSTRAINT "goal_versions_start_aligned_check" CHECK("period" = 'daily'
        OR ("period" = 'weekly' AND strftime('%w', "effective_from") = '1')
        OR ("period" = 'monthly' AND strftime('%d', "effective_from") = '01')
        OR ("period" = 'yearly' AND strftime('%m-%d', "effective_from") = '01-01')),
	CONSTRAINT "goal_versions_end_aligned_check" CHECK("effective_to" IS NULL OR "period" = 'daily'
        OR ("period" = 'weekly' AND strftime('%w', "effective_to") = '0')
        OR ("period" = 'monthly' AND "effective_to" IS date("effective_to", 'start of month', '+1 month', '-1 day'))
        OR ("period" = 'yearly' AND strftime('%m-%d', "effective_to") = '12-31'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goal_versions_one_open` ON `goal_versions` (`goal_id`) WHERE "effective_to" IS NULL;--> statement-breakpoint
CREATE INDEX `goal_versions_by_goal` ON `goal_versions` (`goal_id`,`effective_from`);--> statement-breakpoint
CREATE UNIQUE INDEX `goal_versions_open_ref_goal_unique` ON `goal_versions` (`open_ref`,`goal_id`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`activity` text NOT NULL,
	`metric` text NOT NULL,
	`dhikr_id` text,
	`night_prayer_kind` text,
	`quran_mode` text,
	`currency` text,
	`status` text NOT NULL,
	`archived_at` integer,
	`current_version_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`dhikr_id`) REFERENCES `dhikrs`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`currency`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE restrict,
	-- NOUR manual patch: deferred circular foreign key, see src/db/README.md
	FOREIGN KEY (`current_version_id`,`id`) REFERENCES `goal_versions`(`open_ref`,`goal_id`) ON UPDATE no action ON DELETE no action DEFERRABLE INITIALLY DEFERRED,
	CONSTRAINT "goals_archived_at_integer" CHECK("archived_at" IS NULL OR typeof("archived_at") = 'integer'),
	CONSTRAINT "goals_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "goals_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "goals_id_check" CHECK(length("id") = 36),
	CONSTRAINT "goals_title_check" CHECK(length(trim("title")) BETWEEN 1 AND 120),
	CONSTRAINT "goals_activity_check" CHECK("activity" IN ('dhikr', 'night_prayer', 'quran', 'fasting', 'sadaqa')),
	CONSTRAINT "goals_night_prayer_kind_check" CHECK("night_prayer_kind" IN ('qiyam', 'tahajjud', 'witr')),
	CONSTRAINT "goals_quran_mode_check" CHECK("quran_mode" IN ('reading', 'memorization', 'revision')),
	CONSTRAINT "goals_status_check" CHECK("status" IN ('active', 'archived')),
	CONSTRAINT "goals_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "goals_updated_at_check" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "goals_metric_check" CHECK(("activity" = 'dhikr' AND "metric" IN ('repetitions', 'sessions'))
        OR ("activity" = 'night_prayer' AND "metric" IN ('rakaat', 'nights'))
        OR ("activity" = 'quran' AND "metric" IN ('pages', 'minutes'))
        OR ("activity" = 'fasting' AND "metric" = 'days')
        OR ("activity" = 'sadaqa' AND "metric" IN ('occurrences', 'amount'))),
	CONSTRAINT "goals_dhikr_filter_check" CHECK("dhikr_id" IS NULL OR "activity" = 'dhikr'),
	CONSTRAINT "goals_night_prayer_filter_check" CHECK("night_prayer_kind" IS NULL OR "activity" = 'night_prayer'),
	CONSTRAINT "goals_quran_filter_check" CHECK("quran_mode" IS NULL OR "activity" = 'quran'),
	CONSTRAINT "goals_currency_check" CHECK(("metric" = 'amount') = ("currency" IS NOT NULL)),
	CONSTRAINT "goals_archived_check" CHECK(("status" = 'archived') = ("archived_at" IS NOT NULL)),
	CONSTRAINT "goals_archived_at_check" CHECK("archived_at" IS NULL OR "archived_at" >= "created_at"),
	CONSTRAINT "goals_current_version_check" CHECK(("status" = 'active') = ("current_version_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goals_id_current_version_unique` ON `goals` (`id`,`current_version_id`);--> statement-breakpoint
CREATE TABLE `night_prayer_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`night_id` text NOT NULL,
	`night_date` text NOT NULL,
	`started_at` integer,
	`ended_at` integer,
	`cutoff_min` integer NOT NULL,
	`recorded_at` integer NOT NULL,
	`time_zone` text NOT NULL,
	`utc_offset_min` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`night_id`,`night_date`) REFERENCES `nights`(`id`,`night_date`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "night_prayer_sessions_started_at_integer" CHECK("started_at" IS NULL OR typeof("started_at") = 'integer'),
	CONSTRAINT "night_prayer_sessions_ended_at_integer" CHECK("ended_at" IS NULL OR typeof("ended_at") = 'integer'),
	CONSTRAINT "night_prayer_sessions_cutoff_min_integer" CHECK(typeof("cutoff_min") = 'integer'),
	CONSTRAINT "night_prayer_sessions_recorded_at_integer" CHECK(typeof("recorded_at") = 'integer'),
	CONSTRAINT "night_prayer_sessions_utc_offset_min_integer" CHECK(typeof("utc_offset_min") = 'integer'),
	CONSTRAINT "night_prayer_sessions_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "night_prayer_sessions_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "night_prayer_sessions_id_check" CHECK(length("id") = 36),
	CONSTRAINT "night_prayer_sessions_started_at_check" CHECK("started_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "night_prayer_sessions_cutoff_check" CHECK("cutoff_min" BETWEEN 0 AND 720),
	CONSTRAINT "night_prayer_sessions_recorded_at_check" CHECK("recorded_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "night_prayer_sessions_time_zone_check" CHECK(length("time_zone") BETWEEN 1 AND 64),
	CONSTRAINT "night_prayer_sessions_utc_offset_check" CHECK("utc_offset_min" BETWEEN -720 AND 840 AND "utc_offset_min" % 15 = 0),
	CONSTRAINT "night_prayer_sessions_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "night_prayer_sessions_updated_at_check" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "night_prayer_sessions_end_needs_start_check" CHECK("started_at" IS NOT NULL OR "ended_at" IS NULL),
	CONSTRAINT "night_prayer_sessions_duration_check" CHECK("ended_at" IS NULL OR "ended_at" BETWEEN "started_at" AND "started_at" + 43200000),
	CONSTRAINT "night_prayer_sessions_night_date_check" CHECK("started_at" IS NULL OR "night_date" IS date("started_at" / 1000 + "utc_offset_min" * 60 - "cutoff_min" * 60, 'unixepoch'))
);
--> statement-breakpoint
CREATE INDEX `night_prayer_sessions_by_night` ON `night_prayer_sessions` (`night_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `night_prayer_sessions_id_night_unique` ON `night_prayer_sessions` (`id`,`night_id`);--> statement-breakpoint
CREATE TABLE `night_prayer_units` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`night_id` text NOT NULL,
	`kind` text NOT NULL,
	`rakaat` integer NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`,`night_id`) REFERENCES `night_prayer_sessions`(`id`,`night_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "night_prayer_units_rakaat_integer" CHECK(typeof("rakaat") = 'integer'),
	CONSTRAINT "night_prayer_units_position_integer" CHECK(typeof("position") = 'integer'),
	CONSTRAINT "night_prayer_units_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "night_prayer_units_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "night_prayer_units_id_check" CHECK(length("id") = 36),
	CONSTRAINT "night_prayer_units_kind_check" CHECK("kind" IN ('qiyam', 'tahajjud', 'witr')),
	CONSTRAINT "night_prayer_units_rakaat_check" CHECK("rakaat" BETWEEN 1 AND 99),
	CONSTRAINT "night_prayer_units_position_check" CHECK("position" >= 1),
	CONSTRAINT "night_prayer_units_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "night_prayer_units_updated_at_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE INDEX `night_prayer_units_by_night` ON `night_prayer_units` (`night_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `night_prayer_units_session_position_unique` ON `night_prayer_units` (`session_id`,`position`);--> statement-breakpoint
CREATE TABLE `nights` (
	`id` text PRIMARY KEY NOT NULL,
	`night_date` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "nights_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "nights_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "nights_id_check" CHECK(length("id") = 36),
	CONSTRAINT "nights_night_date_check" CHECK("night_date" IS date("night_date")),
	CONSTRAINT "nights_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "nights_updated_at_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nights_night_date_unique` ON `nights` (`night_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `nights_id_night_date_unique` ON `nights` (`id`,`night_date`);--> statement-breakpoint
CREATE TABLE `quran_readings` (
	`id` text PRIMARY KEY NOT NULL,
	`mushaf` text DEFAULT 'madinah_604' NOT NULL,
	`mode` text NOT NULL,
	`start_page` integer NOT NULL,
	`end_page` integer NOT NULL,
	`start_surah` integer,
	`start_ayah` integer,
	`end_surah` integer,
	`end_ayah` integer,
	`duration_min` integer,
	`occurred_at` integer NOT NULL,
	`local_date` text NOT NULL,
	`time_zone` text NOT NULL,
	`utc_offset_min` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`start_surah`) REFERENCES `quran_surahs`(`number`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`end_surah`) REFERENCES `quran_surahs`(`number`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "quran_readings_start_page_integer" CHECK(typeof("start_page") = 'integer'),
	CONSTRAINT "quran_readings_end_page_integer" CHECK(typeof("end_page") = 'integer'),
	CONSTRAINT "quran_readings_start_surah_integer" CHECK("start_surah" IS NULL OR typeof("start_surah") = 'integer'),
	CONSTRAINT "quran_readings_start_ayah_integer" CHECK("start_ayah" IS NULL OR typeof("start_ayah") = 'integer'),
	CONSTRAINT "quran_readings_end_surah_integer" CHECK("end_surah" IS NULL OR typeof("end_surah") = 'integer'),
	CONSTRAINT "quran_readings_end_ayah_integer" CHECK("end_ayah" IS NULL OR typeof("end_ayah") = 'integer'),
	CONSTRAINT "quran_readings_duration_min_integer" CHECK("duration_min" IS NULL OR typeof("duration_min") = 'integer'),
	CONSTRAINT "quran_readings_occurred_at_integer" CHECK(typeof("occurred_at") = 'integer'),
	CONSTRAINT "quran_readings_utc_offset_min_integer" CHECK(typeof("utc_offset_min") = 'integer'),
	CONSTRAINT "quran_readings_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "quran_readings_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "quran_readings_id_check" CHECK(length("id") = 36),
	CONSTRAINT "quran_readings_mushaf_check" CHECK("mushaf" IN ('madinah_604')),
	CONSTRAINT "quran_readings_mode_check" CHECK("mode" IN ('reading', 'memorization', 'revision')),
	CONSTRAINT "quran_readings_start_page_check" CHECK("start_page" BETWEEN 1 AND 604),
	CONSTRAINT "quran_readings_end_page_check" CHECK("end_page" BETWEEN "start_page" AND 604),
	CONSTRAINT "quran_readings_start_ayah_check" CHECK("start_ayah" >= 1),
	CONSTRAINT "quran_readings_end_ayah_check" CHECK("end_ayah" >= 1),
	CONSTRAINT "quran_readings_duration_check" CHECK("duration_min" BETWEEN 1 AND 1440),
	CONSTRAINT "quran_readings_occurred_at_check" CHECK("occurred_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "quran_readings_local_date_check" CHECK("local_date" IS date("occurred_at" / 1000 + "utc_offset_min" * 60, 'unixepoch')),
	CONSTRAINT "quran_readings_time_zone_check" CHECK(length("time_zone") BETWEEN 1 AND 64),
	CONSTRAINT "quran_readings_utc_offset_check" CHECK("utc_offset_min" BETWEEN -720 AND 840 AND "utc_offset_min" % 15 = 0),
	CONSTRAINT "quran_readings_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "quran_readings_updated_at_check" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "quran_readings_surah_pair_check" CHECK(("start_surah" IS NULL) = ("end_surah" IS NULL)),
	CONSTRAINT "quran_readings_ayah_pair_check" CHECK(("start_ayah" IS NULL) = ("end_ayah" IS NULL)),
	CONSTRAINT "quran_readings_ayah_needs_surah_check" CHECK("start_ayah" IS NULL OR "start_surah" IS NOT NULL),
	CONSTRAINT "quran_readings_range_order_check" CHECK("end_surah" IS NULL OR "end_surah" > "start_surah" OR ("end_surah" = "start_surah" AND ("start_ayah" IS NULL OR "end_ayah" >= "start_ayah")))
);
--> statement-breakpoint
CREATE INDEX `quran_readings_by_date` ON `quran_readings` (`local_date`,`mode`);--> statement-breakpoint
CREATE TABLE `quran_surahs` (
	`number` integer PRIMARY KEY NOT NULL,
	`ayah_count` integer NOT NULL,
	CONSTRAINT "quran_surahs_ayah_count_integer" CHECK(typeof("ayah_count") = 'integer'),
	CONSTRAINT "quran_surahs_number_check" CHECK("number" BETWEEN 1 AND 114),
	CONSTRAINT "quran_surahs_ayah_count_check" CHECK("ayah_count" BETWEEN 3 AND 286)
);
--> statement-breakpoint
CREATE TABLE `sadaqas` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`amount_minor` integer,
	`currency` text,
	`description` text,
	`occurred_at` integer NOT NULL,
	`local_date` text NOT NULL,
	`time_zone` text NOT NULL,
	`utc_offset_min` integer NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`currency`) REFERENCES `currencies`(`code`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "sadaqas_amount_minor_integer" CHECK("amount_minor" IS NULL OR typeof("amount_minor") = 'integer'),
	CONSTRAINT "sadaqas_occurred_at_integer" CHECK(typeof("occurred_at") = 'integer'),
	CONSTRAINT "sadaqas_utc_offset_min_integer" CHECK(typeof("utc_offset_min") = 'integer'),
	CONSTRAINT "sadaqas_created_at_integer" CHECK(typeof("created_at") = 'integer'),
	CONSTRAINT "sadaqas_updated_at_integer" CHECK(typeof("updated_at") = 'integer'),
	CONSTRAINT "sadaqas_id_check" CHECK(length("id") = 36),
	CONSTRAINT "sadaqas_kind_check" CHECK("kind" IN ('money', 'in_kind', 'time', 'other')),
	CONSTRAINT "sadaqas_amount_check" CHECK("amount_minor" BETWEEN 1 AND 999999999999999),
	CONSTRAINT "sadaqas_occurred_at_check" CHECK("occurred_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "sadaqas_local_date_check" CHECK("local_date" IS date("occurred_at" / 1000 + "utc_offset_min" * 60, 'unixepoch')),
	CONSTRAINT "sadaqas_time_zone_check" CHECK(length("time_zone") BETWEEN 1 AND 64),
	CONSTRAINT "sadaqas_utc_offset_check" CHECK("utc_offset_min" BETWEEN -720 AND 840 AND "utc_offset_min" % 15 = 0),
	CONSTRAINT "sadaqas_created_at_check" CHECK("created_at" BETWEEN 946684800000 AND 4102444800000),
	CONSTRAINT "sadaqas_updated_at_check" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "sadaqas_amount_currency_check" CHECK(("amount_minor" IS NULL) = ("currency" IS NULL)),
	CONSTRAINT "sadaqas_money_amount_check" CHECK("kind" <> 'money' OR "amount_minor" IS NOT NULL)
);
--> statement-breakpoint
CREATE INDEX `sadaqas_by_date` ON `sadaqas` (`local_date`);--> statement-breakpoint
CREATE INDEX `sadaqas_by_currency` ON `sadaqas` (`currency`,`local_date`);