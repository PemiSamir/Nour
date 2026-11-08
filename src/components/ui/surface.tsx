import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import type {
  BorderTone,
  BorderWidthToken,
  RadiusToken,
  SpacingToken,
  SurfaceTone,
} from '@/theme';

export type SurfaceProps = ViewProps & {
  /** Background role. Defaults to `background`. */
  tone?: SurfaceTone;
  /** Border role. No border by default. */
  border?: BorderTone | 'none';
  /** Border width, used only when `border` is set. Defaults to `thin`. */
  borderWidth?: BorderWidthToken;
  /** Corner radius. Defaults to `none`. */
  radius?: RadiusToken;
  /** Inner spacing on all sides. */
  padding?: SpacingToken;
  /** Inner horizontal spacing. Overrides `padding` on the left and right. */
  paddingHorizontal?: SpacingToken;
  /** Inner vertical spacing. Overrides `padding` on the top and bottom. */
  paddingVertical?: SpacingToken;
};

export function Surface({
  tone = 'background',
  border = 'none',
  borderWidth = 'thin',
  radius = 'none',
  padding,
  paddingHorizontal,
  paddingVertical,
  style,
  ...rest
}: SurfaceProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.surfaceColors[tone],
          borderRadius: theme.radii[radius],
        },
        border !== 'none' && {
          borderColor: theme.colors.border[border],
          borderWidth: theme.borderWidths[borderWidth],
        },
        padding !== undefined && { padding: theme.spacing[padding] },
        paddingHorizontal !== undefined && { paddingHorizontal: theme.spacing[paddingHorizontal] },
        paddingVertical !== undefined && { paddingVertical: theme.spacing[paddingVertical] },
        style,
      ]}
      {...rest}
    />
  );
}
