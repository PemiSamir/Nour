import { DarkTheme, type Theme } from 'expo-router';

import { colors } from './colors';

/** Expo Router theme built from the NOUR tokens. Fonts keep the platform defaults. */
export const navigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    primary: colors.accent.base,
    background: colors.background.base,
    card: colors.background.elevated,
    text: colors.text.primary,
    border: colors.border.subtle,
    notification: colors.status.error,
  },
};
