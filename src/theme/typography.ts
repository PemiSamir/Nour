import '@/global.css';

import { Platform } from 'react-native';

/**
 * Font families. Dedicated Latin and Arabic fonts are not bundled yet, so both
 * use the platform system font. iOS and Android fall back to their own Arabic
 * system fonts for Arabic glyphs.
 */
export const fontFamilies = {
  sans: Platform.select({ ios: 'system-ui', web: 'var(--font-display)', default: 'normal' }),
  arabic: Platform.select({ ios: 'system-ui', web: 'var(--font-display)', default: 'normal' }),
  mono: Platform.select({ ios: 'ui-monospace', web: 'var(--font-mono)', default: 'monospace' }),
} as const;

export const fontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type FontWeight = (typeof fontWeights)[keyof typeof fontWeights];

export type TextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'small' | 'caption';

type VariantStyle = {
  fontSize: number;
  lineHeight: number;
  fontWeight: FontWeight;
};

/** Latin text scale. Line height is about 1.25 to 1.5 times the font size. */
export const textVariants: Record<TextVariant, VariantStyle> = {
  display: { fontSize: 32, lineHeight: 40, fontWeight: fontWeights.semibold },
  title: { fontSize: 24, lineHeight: 32, fontWeight: fontWeights.semibold },
  subtitle: { fontSize: 20, lineHeight: 28, fontWeight: fontWeights.medium },
  body: { fontSize: 16, lineHeight: 24, fontWeight: fontWeights.regular },
  small: { fontSize: 14, lineHeight: 20, fontWeight: fontWeights.regular },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: fontWeights.regular },
};

/**
 * Arabic text scale. Arabic glyphs and diacritics need larger sizes and a line
 * height of about 1.7 times the font size. Letter spacing must stay at 0,
 * because it breaks the joins between Arabic letters.
 */
export const arabicTextVariants: Record<TextVariant, VariantStyle> = {
  display: { fontSize: 36, lineHeight: 60, fontWeight: fontWeights.semibold },
  title: { fontSize: 28, lineHeight: 48, fontWeight: fontWeights.semibold },
  subtitle: { fontSize: 24, lineHeight: 40, fontWeight: fontWeights.medium },
  body: { fontSize: 20, lineHeight: 34, fontWeight: fontWeights.regular },
  small: { fontSize: 17, lineHeight: 29, fontWeight: fontWeights.regular },
  caption: { fontSize: 14, lineHeight: 24, fontWeight: fontWeights.regular },
};
