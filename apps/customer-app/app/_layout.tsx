import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { useFonts, NotoSansGeorgian_400Regular, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_800ExtraBold } from '@expo-google-fonts/noto-sans-georgian';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { CartProvider } from '../src/state/cart';
import { FavoritesProvider } from '../src/state/favorites';
import { AppFrame } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useOnline } from '../src/lib/net';
import { usePushRegistration } from '../src/lib/push';

const PUBLIC = new Set(['', 'index', 'login', 'otp', 'legal']);

/** Sends signed-out users to the login screen. The server (RLS) is the real protection; this is only navigation. */
function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const first = (segments[0] as string | undefined) ?? '';
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive && !data.session && !PUBLIC.has(first)) router.replace('/login'); });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT' && !PUBLIC.has(first)) router.replace('/login'); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [first, router]);
  usePushRegistration();
  return null;
}

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, backgroundColor: colors.red, paddingVertical: 8, paddingHorizontal: 16 }}>
      <Text style={{ color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 13, textAlign: 'center' }}>{ka.common.offline}</Text>
    </View>
  );
}

export default function Layout() {
  const [loaded] = useFonts({ NotoSansGeorgian_400Regular, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.brand }}><ActivityIndicator color={colors.onBrand} /></View>;
  return (
    <CartProvider>
      <FavoritesProvider>
        <StatusBar style="light" />
        <AppFrame>
          <AuthGuard />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: theme.bg } }} />
          <OfflineBanner />
        </AppFrame>
      </FavoritesProvider>
    </CartProvider>
  );
}
