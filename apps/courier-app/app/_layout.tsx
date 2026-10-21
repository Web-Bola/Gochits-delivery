import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansGeorgian_400Regular, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_800ExtraBold } from '@expo-google-fonts/noto-sans-georgian';
import { supabase } from '../src/supabase';
import { gateFor, PATH } from '../src/gate';
import { c } from '../src/ui';

const OPEN = ['welcome', 'login', 'register', 'pending'];

/** Navigation only: signed-out users see the welcome screen, non-couriers are sent to registration / "pending". The server (RLS + role checks) is the real protection. */
function AuthGuard() {
  const router = useRouter();
  const first = (useSegments()[0] as string | undefined) ?? '';
  useEffect(() => {
    let alive = true;
    (async () => {
      const g = await gateFor();
      if (!alive) return;
      if (g === 'login') { if (!OPEN.includes(first)) router.replace('/welcome'); return; }
      if (first === '' && g !== 'home') router.replace(PATH[g]);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') router.replace('/welcome'); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [first, router]);
  return null;
}

export default function Layout() {
  const [loaded] = useFonts({ NotoSansGeorgian_400Regular, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: c.bg }}><ActivityIndicator color={c.brand} /></View>;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false, animation: 'fade_from_bottom', contentStyle: { backgroundColor: c.bg } }} />
    </SafeAreaProvider>
  );
}
