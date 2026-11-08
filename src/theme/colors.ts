/**
 * NOUR color tokens.
 *
 * `palette` holds the raw brand colors. It is internal to `src/theme` and is not
 * exported by the public theme index: components read the semantic roles in
 * `colors`, so a role can change without touching any component.
 *
 * Allowed text and background pairs are listed in `contrast.ts`, which also
 * holds the functions that verify them. Ratios below are WCAG 2 contrast ratios
 * computed on the composited colors. AA requires 4.5 for body text and 3 for
 * large text and for the boundaries of interactive controls.
 */
export const palette = {
  midnight: '#14212B',
  emerald: '#183B2E',
  softGold: '#D0AD62',
  offWhite: '#E9E5DC',
} as const;

export const colors = {
  background: {
    /** Main app background. */
    base: palette.midnight,
    /** Slightly raised areas on the background: sheets, headers. Off-white at 5% on Midnight. */
    elevated: '#1F2B34',
  },
  surface: {
    /** Cards and grouped content. */
    base: palette.emerald,
    /** Pressed or highlighted surface. Off-white at 6% on Emerald. */
    pressed: '#254538',
    /** Disabled control background. Pair it with `text.disabled`. */
    disabled: 'rgba(233, 229, 220, 0.08)',
  },
  text: {
    /** Allowed on every background and surface. 13.0 on Midnight, 8.4 on pressed Emerald. */
    primary: palette.offWhite,
    /** Off-white at 72%. Allowed on every background and surface. 4.7 on pressed Emerald. */
    secondary: '#ADAEAA',
    /**
     * Off-white at 55%. Allowed on the Midnight background only: 4.9 there,
     * 4.3 on elevated Midnight, 3.7 on Emerald and 3.2 on pressed Emerald.
     */
    muted: '#898D8C',
    /** Off-white at 38%. Disabled content is exempt from WCAG contrast rules. */
    disabled: '#656B6E',
    /** Text on a Soft Gold action background only. 7.7 on Soft Gold, 6.0 on pressed gold. */
    onAccent: palette.midnight,
  },
  accent: {
    /**
     * Actions, links and highlights. Allowed as text on every background and surface:
     * 7.7 on Midnight, 5.0 on pressed Emerald.
     *
     * As a background, Soft Gold is reserved for action components such as buttons,
     * and it always carries `text.onAccent`. Surfaces do not offer a gold tone.
     */
    base: palette.softGold,
    /** Pressed action background. */
    pressed: '#B79856',
  },
  border: {
    /** Decorative separators only. 1.4 on every background: not a control boundary. */
    subtle: 'rgba(233, 229, 220, 0.12)',
    /** Stronger decorative separators. 2.0 on Midnight: not a control boundary. */
    strong: 'rgba(233, 229, 220, 0.24)',
    /** Boundaries of interactive controls such as inputs. At least 3.0 on every background. */
    control: 'rgba(233, 229, 220, 0.5)',
    /** Gold outline for selected or highlighted elements. */
    accent: palette.softGold,
  },
  focus: {
    /** Focus indicator. At least 3.0 on every background once composited. */
    ring: 'rgba(208, 173, 98, 0.75)',
  },
  status: {
    /** Allowed on every background and surface. 8.4 on Midnight, 5.4 on pressed Emerald. */
    success: '#8CC7A1',
    /**
     * Allowed on every background and surface. 7.8 on Midnight, 5.0 on pressed Emerald.
     * Its luminance is close to Soft Gold: always pair a warning with an icon or a label.
     */
    warning: '#E8A55D',
    /**
     * Allowed on every background and surface. 7.2 on Midnight, 4.6 on pressed Emerald.
     * Lightened from #E58A80, which fell to 4.2 on pressed Emerald.
     */
    error: '#E6988E',
  },
} as const;

/** Color roles available to text. */
export const textColors = {
  primary: colors.text.primary,
  secondary: colors.text.secondary,
  muted: colors.text.muted,
  disabled: colors.text.disabled,
  onAccent: colors.text.onAccent,
  accent: colors.accent.base,
  success: colors.status.success,
  warning: colors.status.warning,
  error: colors.status.error,
} as const;

export type TextColor = keyof typeof textColors;

/**
 * Background roles available to surfaces. Soft Gold is deliberately absent:
 * gold backgrounds belong to action components, which pair them with Midnight text.
 */
export const surfaceColors = {
  background: colors.background.base,
  elevated: colors.background.elevated,
  surface: colors.surface.base,
  pressed: colors.surface.pressed,
  disabled: colors.surface.disabled,
  transparent: 'transparent',
} as const;

export type SurfaceTone = keyof typeof surfaceColors;

/** Border roles available to surfaces. */
export type BorderTone = keyof typeof colors.border;
