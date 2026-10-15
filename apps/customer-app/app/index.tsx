import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@gochits/ui-tokens';
import { supabase } from '../src/lib/supabase';

export default function Splash() {
  const router = useRouter();
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: Platform.OS !== 'web' }).start();
    let alive = true;
    const minWait = new Promise((r) => setTimeout(r, 1100));
    Promise.all([supabase.auth.getSession(), minWait]).then(([{ data }]) => {
      if (alive) router.replace(data.session ? '/address' : '/login');
    }).catch(() => alive && router.replace('/login'));
    return () => { alive = false; };
  }, [router, pop]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }}>
        <Image source={require('../assets/logo.png')} style={{ width: 240, height: 240 }} resizeMode="contain" accessibilityLabel="Gochit's" />
      </Animated.View>
    </View>
  );
}
