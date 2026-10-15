import { useEffect, useRef } from 'react';
import { Animated, Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@gochits/ui-tokens';
import { supabase } from '../src/lib/supabase';
import { Float, ND, Pulse } from '../src/components/fx';
import { Stripe } from '../src/components/ui';

export default function Splash() {
  const router = useRouter();
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 60, useNativeDriver: ND }).start();
    let alive = true;
    const minWait = new Promise((r) => setTimeout(r, 1500));
    Promise.all([supabase.auth.getSession(), minWait]).then(([{ data }]) => {
      if (alive) router.replace(data.session ? '/address' : '/login');
    }).catch(() => alive && router.replace('/login'));
    return () => { alive = false; };
  }, [router, pop]);
  return (
    <View style={{ flex: 1, backgroundColor: colors.yellow }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ position: 'absolute', width: 420, height: 420, borderRadius: 210, backgroundColor: '#FFD83A' }} />
        <Pulse size={240} color={colors.ink} />
        <Pulse size={240} color={colors.red} delay={900} />
        <Pulse size={240} color={colors.white} delay={1800} />
        <Float amplitude={10}>
          <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) }] }}>
            <Image source={require('../assets/logo.png')} style={{ width: 250, height: 250 }} resizeMode="contain" accessibilityLabel="Gochit's" />
          </Animated.View>
        </Float>
      </View>
      <Stripe height={18} />
    </View>
  );
}
