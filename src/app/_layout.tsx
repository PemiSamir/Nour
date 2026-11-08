import { Stack, ThemeProvider } from 'expo-router';

import { navigationTheme } from '@/theme';

export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
