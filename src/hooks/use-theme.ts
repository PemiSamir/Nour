import { theme, type NourTheme } from '@/theme';

/**
 * Returns the NOUR theme. The app is dark only, so the theme is static for now.
 * Components read their colors through this hook only, so a dynamic theme can
 * be added later without changing them.
 */
export function useTheme(): NourTheme {
  return theme;
}
