/**
 * NOUR database schema: 14 tables, 12 business tables and 2 reference tables.
 * Triggers are added in 5.4, reference rows in a dedicated step after 5.4.
 */
export { appSettings } from './settings';
export { currencies, quranSurahs } from './reference';
export { DHIKR_ENTRY_MODES, DHIKR_SESSION_STATUSES, dhikrSessions, dhikrs } from './dhikr';
export { NIGHT_PRAYER_KINDS, nightPrayerSessions, nightPrayerUnits, nights } from './night-prayer';
export { MUSHAFS, QURAN_MODES, quranReadings } from './quran';
export { FAST_KINDS, FAST_STATUSES, fasts } from './fasting';
export { SADAQA_KINDS, sadaqas } from './sadaqa';
export {
  GOAL_ACTIVITIES,
  GOAL_METRICS,
  GOAL_REMINDER_KINDS,
  GOAL_STATUSES,
  GOAL_VERSION_PERIODS,
  goalReminders,
  goalVersions,
  goals,
} from './goals';
