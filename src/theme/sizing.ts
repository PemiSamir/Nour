/** Corner radii. */
export const radii = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radii;

export const sizes = {
  /** Minimum touch target, following the Android 48dp guideline. iOS asks for 44pt. */
  touchTarget: 48,
  icon: { sm: 16, md: 20, lg: 24, xl: 32 },
  control: { sm: 40, md: 48, lg: 56 },
  /** Maximum content width on tablets and web. */
  maxContentWidth: 800,
} as const;
