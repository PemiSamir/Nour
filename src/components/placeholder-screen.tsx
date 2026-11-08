import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { sizes, spacing } from '@/theme';

export type PlaceholderScreenProps = {
  /** Screen title, announced as a heading. Omit it when a navigation header already shows it. */
  title?: string;
  /** Short neutral message. It must not present fictitious data as real. */
  description?: string;
};

/**
 * Temporary screen for a feature that is not built yet. It only shows a title
 * and a neutral message, with no business logic and no sample data.
 *
 * The bottom safe area is left to the navigation: the native tab bar and the
 * stack header already handle their own insets.
 */
export function PlaceholderScreen({
  title,
  description = 'Cet écran sera disponible prochainement.',
}: PlaceholderScreenProps) {
  return (
    <Surface tone="background" style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.content}>
        {title ? (
          <Text variant="title" align="center">
            {title}
          </Text>
        ) : null}
        <Text color="secondary" align="center">
          {description}
        </Text>
      </SafeAreaView>
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    maxWidth: sizes.maxContentWidth,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
