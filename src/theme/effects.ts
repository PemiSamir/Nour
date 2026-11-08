import { StyleSheet } from 'react-native';

import { colors } from './colors';

export const borderWidths = {
  none: 0,
  hairline: StyleSheet.hairlineWidth,
  thin: 1,
  thick: 2,
} as const;

export type BorderWidthToken = keyof typeof borderWidths;

/**
 * Shadows use the cross-platform `boxShadow` style available since React Native 0.76.
 * On a dark background they are barely visible, so depth comes mainly from
 * surface tones and borders. Keep shadows for floating elements and focus.
 *
 * There is no `none` token: an element without a shadow simply omits `boxShadow`.
 */
export const shadows = {
  floating: '0px 8px 24px rgba(0, 0, 0, 0.35)',
  /** Focus ring. Its color is checked against every background in `contrast.ts`. */
  focus: `0px 0px 0px 3px ${colors.focus.ring}`,
} as const;

export type ShadowToken = keyof typeof shadows;

/**
 * Opacity feedback for pressed elements. Disabled states use the dedicated
 * disabled colors instead of an opacity.
 */
export const opacities = {
  pressed: 0.7,
} as const;
