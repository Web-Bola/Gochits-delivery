import { useEffect } from 'react';
import { Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@gochits/ui-tokens';
import { supabase } from '../src/lib/supabase';

export default function Splash() {
  const router = useRouter();
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) router.replace(data.session ? '/address' : '/login');
    }).catch(() => alive && router.replace('/login'));
    return () => { alive = false; };
  }, [router]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' }}>
      <Image source={require('../assets/logo.png')} style={{ width: 220, height: 220 }} resizeMode="contain" accessibilityLabel="Gochit's" />
    </View>
  );
}
