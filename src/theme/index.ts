import { colors, surfaceColors, textColors } from './colors';
import { borderWidths, opacities, shadows } from './effects';
import { navigationTheme } from './navigation';
import { radii, sizes } from './sizing';
import { spacing } from './spacing';
import { arabicTextVariants, fontFamilies, fontWeights, textVariants } from './typography';

// The raw palette stays internal to src/theme: only semantic roles are public.
export {
  colors,
  surfaceColors,
  textColors,
  type BorderTone,
  type SurfaceTone,
  type TextColor,
} from './colors';
export * from './contrast';
export * from './effects';
export * from './navigation';
export * from './sizing';
export * from './spacing';
export * from './typography';

/** The single NOUR theme. The app is dark only, as set in app.json. */
export const theme = {
  colors,
  textColors,
  surfaceColors,
  typography: { fontFamilies, fontWeights, textVariants, arabicTextVariants },
  spacing,
  radii,
  sizes,
  borderWidths,
  shadows,
  opacities,
  navigation: navigationTheme,
} as const;

/** Same keys as the token table, with every color value widened to `string`. */
type ColorTable<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : ColorTable<T[K]>;
};

/**
 * Shape every NOUR theme must follow. Color values are widened to `string`, so a
 * future light theme can provide other colors with the same roles.
 */
export type NourTheme = Omit<
  typeof theme,
  'colors' | 'textColors' | 'surfaceColors' | 'shadows'
> & {
  readonly colors: ColorTable<typeof colors>;
  readonly textColors: ColorTable<typeof textColors>;
  readonly surfaceColors: ColorTable<typeof surfaceColors>;
  readonly shadows: ColorTable<typeof shadows>;
};
