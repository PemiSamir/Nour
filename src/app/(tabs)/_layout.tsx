import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/hooks/use-theme';

/**
 * The five main tabs of NOUR. Android allows at most five tabs, so other
 * features such as fasting, sadaqa or settings are stacked screens, not tabs.
 *
 * Contrast on the elevated Midnight bar: Soft Gold 6.8, secondary text 6.5.
 * On iOS 26 and later the system draws the bar background, so
 * `backgroundColor` only applies to earlier iOS versions and to Android.
 */
export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <NativeTabs
      backBehavior="initialRoute"
      backgroundColor={colors.background.elevated}
      tintColor={colors.accent.base}
      iconColor={{ default: colors.text.secondary, selected: colors.accent.base }}
      labelStyle={{
        default: { color: colors.text.secondary },
        selected: { color: colors.accent.base },
      }}
      indicatorColor={colors.surface.base}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Accueil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="prayers">
        <NativeTabs.Trigger.Label>Prières</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'moon.stars', selected: 'moon.stars.fill' }}
          md="mosque"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="adhkar">
        <NativeTabs.Trigger.Label>Adhkar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'hands.and.sparkles', selected: 'hands.and.sparkles.fill' }}
          md="auto_awesome"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="quran">
        <NativeTabs.Trigger.Label>Coran</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="menu_book" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bilan">
        <NativeTabs.Trigger.Label>Bilan</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
          md="bar_chart"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
