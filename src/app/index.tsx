import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Surface } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { sizes, spacing } from '@/theme';

export default function HomeScreen() {
  return (
    <Surface tone="background" style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Text variant="display" color="accent" align="center">
          NOUR
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
  safeArea: {
    flex: 1,
    maxWidth: sizes.maxContentWidth,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
