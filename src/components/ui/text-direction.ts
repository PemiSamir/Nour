import { Children, type ReactNode } from 'react';

/**
 * Right-to-left mark (U+200F). It is invisible and has no width, but it is a
 * strong right-to-left character for the Unicode bidirectional algorithm.
 */
export const RIGHT_TO_LEFT_MARK = '‏';

/**
 * Returns the `textAlign` value that places Arabic text on the physical right.
 *
 * React Native swaps `left` and `right` when the layout is right-to-left, on
 * iOS and on Android. So the value depends on the layout direction:
 * - left-to-right layout, the current French interface: `right`;
 * - right-to-left layout, a future Arabic interface: `left`, which React Native
 *   renders on the right.
 *
 * Physical values are used on purpose instead of `start` and `end`: on the web,
 * `start` and `end` follow the CSS direction of the text itself, which is
 * right-to-left for Arabic, and would place the text on the left.
 */
export function arabicTextAlign(isLayoutRTL: boolean): 'left' | 'right' {
  return isLayoutRTL ? 'left' : 'right';
}

/**
 * Makes Android lay out Arabic paragraphs from right to left.
 *
 * Android ignores the `writingDirection` style. It picks each paragraph's
 * direction from its first strong character, so Arabic content that starts
 * with a Latin word would be laid out from left to right. A right-to-left mark
 * is added at the start of the text and after each line break, so every
 * paragraph starts with a strong right-to-left character.
 *
 * Only string children are changed. Nested elements keep their own content,
 * and React keys are added by `Children.map`.
 */
export function markRightToLeftParagraphs(children: ReactNode): ReactNode {
  if (children === null || children === undefined || typeof children === 'boolean') {
    return children;
  }

  const marked = Children.map(children, (child) =>
    typeof child === 'string' ? child.split('\n').join(`\n${RIGHT_TO_LEFT_MARK}`) : child
  );

  return [RIGHT_TO_LEFT_MARK, ...(marked ?? [])];
}
