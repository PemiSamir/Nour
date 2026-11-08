import {
  I18nManager,
  Platform,
  Text as RNText,
  StyleSheet,
  type TextProps as RNTextProps,
  type TextStyle,
} from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type { TextColor, TextVariant } from '@/theme';

import { arabicTextAlign, markRightToLeftParagraphs } from './text-direction';

export type TextProps = RNTextProps & {
  /** Typographic scale step. Defaults to `body`. */
  variant?: TextVariant;
  /** Semantic color role. Defaults to `primary`. */
  color?: TextColor;
  /**
   * Text alignment, with the React Native semantics: `left` and `right` are
   * swapped in a right-to-left layout. Arabic text defaults to the physical right.
   */
  align?: TextStyle['textAlign'];
  /** Forces the bold weight on top of the variant weight. */
  bold?: boolean;
  /**
   * Arabic mode: right-to-left paragraphs aligned on the right, Arabic scale
   * with a taller line height, Arabic font family and no letter spacing.
   * The rest of the interface keeps its own direction.
   */
  arabic?: boolean;
};

/** Variants announced as headings to screen readers unless a role is given. */
const HEADING_VARIANTS: readonly TextVariant[] = ['display', 'title'];

export function Text({
  variant = 'body',
  color = 'primary',
  align,
  bold = false,
  arabic = false,
  accessibilityLanguage,
  accessibilityRole,
  role,
  children,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const { typography } = theme;
  const scale = arabic ? typography.arabicTextVariants : typography.textVariants;
  const textAlign =
    align ?? (arabic ? arabicTextAlign(I18nManager.getConstants().isRTL) : undefined);

  // A role given by the caller, through `role` or `accessibilityRole`, always wins.
  const isDefaultHeading =
    role === undefined && accessibilityRole === undefined && HEADING_VARIANTS.includes(variant);

  // iOS and the web honor `writingDirection`. Android does not, see text-direction.ts.
  const content =
    arabic && Platform.OS === 'android' ? markRightToLeftParagraphs(children) : children;

  return (
    <RNText
      role={role}
      accessibilityRole={isDefaultHeading ? 'header' : accessibilityRole}
      accessibilityLanguage={accessibilityLanguage ?? (arabic ? 'ar' : undefined)}
      style={[
        {
          color: theme.textColors[color],
          fontFamily: arabic ? typography.fontFamilies.arabic : typography.fontFamilies.sans,
        },
        scale[variant],
        bold && { fontWeight: typography.fontWeights.bold },
        textAlign !== undefined && { textAlign },
        arabic && styles.arabic,
        style,
        // Applied last on purpose: letter spacing breaks the joins between Arabic letters.
        arabic && styles.arabicSpacing,
      ]}
      {...rest}>
      {content}
    </RNText>
  );
}

const styles = StyleSheet.create({
  arabic: {
    writingDirection: 'rtl',
  },
  arabicSpacing: {
    letterSpacing: 0,
  },
});
