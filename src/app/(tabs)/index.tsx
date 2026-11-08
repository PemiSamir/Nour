import { Link } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { opacities, sizes, spacing } from '@/theme';

export default function HomeScreen() {
  return (
    <Surface tone="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text variant="display" color="accent" align="center">
          NOUR
        </Text>

        {/* Temporary access to the settings until the home screen is designed. */}
        <Link href="/settings" asChild>
          <Pressable
            accessibilityRole="link"
            style={({ pressed }) => [styles.settingsLink, pressed && styles.pressed]}>
            <Text color="accent" style={styles.linkLabel}>
              Ouvrir les paramètres
            </Text>
          </Pressable>
        </Link>
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
  safeArea: {
    flex: 1,
    maxWidth: sizes.maxContentWidth,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  settingsLink: {
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  linkLabel: {
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: opacities.pressed,
  },
});
