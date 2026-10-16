import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontFamily } from '@gochits/ui-tokens';
import { supabase } from '../src/lib/supabase';
import { Float, ND, useLoop } from '../src/components/fx';

/** Opening screen from the first design: yellow, drifting seeds, logo pop, loading bar and a "start" button. */
export default function Splash() {
  const router = useRouter();
  const pop = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const bar = useLoop(1600);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 60, useNativeDriver: ND }).start();
    Animated.timing(rise, { toValue: 1, duration: 700, delay: 1000, useNativeDriver: ND }).start();
  }, [pop, rise]);

  async function start() {
    setBusy(true);
    try {
      const { data } = await supabase.auth.getSession();
      router.replace(data.session ? '/menu' : '/login');
    } catch {
      router.replace('/login');
    }
  }

  const seed = (left: number, top: number, d: number, sc = 1) => <Seed key={`${left}-${top}`} left={left} top={top} d={d} sc={sc} />;
  const up = { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] };
  return (
    <View style={{ flex: 1, backgroundColor: colors.yellow, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', gap: 28, padding: 32 }}>
      {seed(46, 90, 4400)}{seed(300, 150, 5600, 0.7)}{seed(70, 610, 6200, 0.9)}{seed(320, 690, 4900)}{seed(210, 60, 5100, 0.6)}
      <View style={{ position: 'absolute', left: -90, bottom: -110, width: 320, height: 320, borderRadius: 160, backgroundColor: colors.orange, opacity: 0.9 }} />
      <View style={{ position: 'absolute', right: -70, top: -80, width: 220, height: 220, borderRadius: 110, backgroundColor: '#FFE066' }} />
      <Float amplitude={10} duration={1700}>
        <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '0deg'] }) }] }}>
          <Image source={require('../assets/logo.png')} style={{ width: 280, height: 280 }} resizeMode="contain" accessibilityLabel="Gochit's" />
        </Animated.View>
      </Float>
      <Animated.View style={[{ alignItems: 'center', gap: 14, width: '100%' }, up]}>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 22, color: colors.ink }}>მოგესალმებით</Text>
        <View style={{ width: 180, height: 8, borderRadius: 8, backgroundColor: 'rgba(26,13,11,0.15)', overflow: 'hidden' }}>
          <Animated.View style={{ width: 70, height: 8, borderRadius: 8, backgroundColor: colors.red, transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-70, 180] }) }] }} />
        </View>
      </Animated.View>
      <Animated.View style={[{ width: '100%' }, up]}>
        <Pressable accessibilityRole="button" onPress={start} disabled={busy}
          style={({ pressed }) => ({ minHeight: 56, borderRadius: 28, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: colors.yellow }}>დაწყება</Text>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: colors.yellow }}>→</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function Seed({ left, top, d, sc }: { left: number; top: number; d: number; sc: number }) {
  const v = useLoop(d);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left, top, width: 14, height: 22, borderRadius: 11, backgroundColor: '#FFF6C9', opacity: 0.75,
      transform: [{ scale: sc }, { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -26] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '40deg'] }) }] }} />
  );
}
