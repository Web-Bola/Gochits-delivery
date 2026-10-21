import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, NotoSansGeorgian_400Regular, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_800ExtraBold } from '@expo-google-fonts/noto-sans-georgian';
import { colors } from '@gochits/ui-tokens';
import { supabase } from '../src/supabase';

/** Navigation only: signed-out users go to the login screen. The server (RLS + role checks) is the real protection. */
function AuthGuard() {
  const router = useRouter();
  const first = (useSegments()[0] as string | undefined) ?? '';
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive && !data.session && first !== 'login') router.replace('/login'); });
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') router.replace('/login'); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [first, router]);
  return null;
}

export default function Layout() {
  const [loaded] = useFonts({ NotoSansGeorgian_400Regular, NotoSansGeorgian_600SemiBold, NotoSansGeorgian_800ExtraBold });
  if (!loaded) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: '#FFFFFF' }}><ActivityIndicator color={'#0E6B57'} /></View>;
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthGuard />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: '#FFFFFF' } }} />
    </SafeAreaProvider>
  );
}
