import { colors, textColors, type TextColor } from './colors';

/**
 * WCAG 2 contrast utilities and the list of allowed color pairs.
 *
 * This module has no React Native dependency, so it can run in unit tests or in
 * a plain script. Translucent colors are composited before measuring: a
 * translucent background over the Midnight base, then the foreground over the
 * resulting background.
 */

type Rgb = readonly [number, number, number];
type Rgba = { readonly rgb: Rgb; readonly alpha: number };

/** Minimum ratios required by WCAG 2.2 level AA. */
export const contrastThresholds = {
  /** Body text. */
  text: 4.5,
  /** Text of at least 24px, or 18.66px bold. */
  largeText: 3,
  /** Control boundaries and focus indicators. */
  nonText: 3,
} as const;

/** Parses `#RGB`, `#RRGGBB`, `rgb()`, `rgba()` and `transparent`. */
export function parseColor(value: string): Rgba {
  const input = value.trim().toLowerCase();

  if (input === 'transparent') {
    return { rgb: [0, 0, 0], alpha: 0 };
  }

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(input);
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((d) => d + d).join('') : hex[1];
    return {
      rgb: [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16)) as unknown as Rgb,
      alpha: 1,
    };
  }

  const fn = /^rgba?\(([^)]+)\)$/.exec(input);
  if (fn) {
    const parts = fn[1].split(',').map((part) => Number(part.trim()));
    if ((parts.length === 3 || parts.length === 4) && parts.every((n) => Number.isFinite(n))) {
      return { rgb: [parts[0], parts[1], parts[2]], alpha: parts[3] ?? 1 };
    }
  }

  throw new Error(`Unsupported color: ${value}`);
}

/** Composites a possibly translucent color over an opaque one. */
export function composite(foreground: Rgba, background: Rgb): Rgb {
  const { rgb, alpha } = foreground;
  return [0, 1, 2].map((i) => rgb[i] * alpha + background[i] * (1 - alpha)) as unknown as Rgb;
}

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of an opaque color, as defined by WCAG 2. */
export function relativeLuminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map(channelToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Contrast ratio between a foreground and a background, from 1 to 21.
 * Translucent colors are composited first. `base` is what lies behind a
 * translucent background; it defaults to the Midnight app background.
 */
export function contrastRatio(
  foreground: string,
  background: string,
  base: string = colors.background.base
): number {
  const baseRgb = composite(parseColor(base), [0, 0, 0]);
  const backgroundRgb = composite(parseColor(background), baseRgb);
  const foregroundRgb = composite(parseColor(foreground), backgroundRgb);
  const lighter = Math.max(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
  const darker = Math.min(relativeLuminance(foregroundRgb), relativeLuminance(backgroundRgb));
  return (lighter + 0.05) / (darker + 0.05);
}

/** Opaque backgrounds that text and controls are placed on. */
export const contrastBackgrounds = {
  background: colors.background.base,
  elevated: colors.background.elevated,
  surface: colors.surface.base,
  pressed: colors.surface.pressed,
  action: colors.accent.base,
  actionPressed: colors.accent.pressed,
} as const;

export type ContrastBackground = keyof typeof contrastBackgrounds;

const neutralBackgrounds = ['background', 'elevated', 'surface', 'pressed'] as const;

/**
 * Backgrounds on which each text color meets AA for body text.
 * `disabled` is exempt from WCAG contrast rules and has no entry to check.
 */
export const allowedTextBackgrounds: Record<
  Exclude<TextColor, 'disabled'>,
  readonly ContrastBackground[]
> = {
  primary: neutralBackgrounds,
  secondary: neutralBackgrounds,
  muted: ['background'],
  onAccent: ['action', 'actionPressed'],
  accent: neutralBackgrounds,
  success: neutralBackgrounds,
  warning: neutralBackgrounds,
  error: neutralBackgrounds,
};

export type ContrastCheck = {
  readonly foreground: string;
  readonly background: ContrastBackground;
  readonly ratio: number;
  readonly required: number;
  readonly passes: boolean;
};

function check(foreground: string, background: ContrastBackground, required: number): ContrastCheck {
  const ratio = contrastRatio(colorOf(foreground), contrastBackgrounds[background]);
  return { foreground, background, ratio, required, passes: ratio >= required };
}

function colorOf(token: string): string {
  if (token in textColors) {
    return textColors[token as TextColor];
  }
  if (token === 'border.control') {
    return colors.border.control;
  }
  if (token === 'focus.ring') {
    return colors.focus.ring;
  }
  throw new Error(`Unknown token: ${token}`);
}

/**
 * Checks every allowed text pair, the control border and the focus ring.
 * An empty list of failures means the tokens meet AA.
 */
export function auditContrast(): ContrastCheck[] {
  const results: ContrastCheck[] = [];

  for (const [textColor, backgrounds] of Object.entries(allowedTextBackgrounds)) {
    for (const background of backgrounds) {
      results.push(check(textColor, background, contrastThresholds.text));
    }
  }

  for (const background of neutralBackgrounds) {
    results.push(check('border.control', background, contrastThresholds.nonText));
    results.push(check('focus.ring', background, contrastThresholds.nonText));
  }

  return results;
}
