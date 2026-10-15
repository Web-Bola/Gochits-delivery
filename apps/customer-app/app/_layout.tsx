import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useFonts, NotoSansGeorgian_400Regular, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_800ExtraBold } from '@expo-google-fonts/noto-sans-georgian';
import { colors, theme } from '@gochits/ui-tokens';
import { CartProvider } from '../src/state/cart';
import { AppFrame } from '../src/components/ui';

export default function Layout() {
  const [loaded] = useFonts({ NotoSansGeorgian_400Regular, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.yellow }}><ActivityIndicator color={colors.ink} /></View>;
  return (
    <CartProvider>
      <StatusBar style="light" />
      <AppFrame>
        <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: theme.bg } }} />
      </AppFrame>
    </CartProvider>
  );
}
