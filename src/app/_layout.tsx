import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { navigationTheme } from '@/theme';

/**
 * The tabs group is the anchor of the root stack: a deep link to a stacked
 * screen such as `/settings` keeps a way back to the tabs.
 */
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      {/* The app is dark only, so the status bar text is always light. */}
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: true,
            title: 'Paramètres',
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
