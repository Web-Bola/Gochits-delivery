import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@gochits/ui-tokens';
import { supabase } from '../src/lib/supabase';
import { ND } from '../src/components/fx';

const MIN_MS = 1800;

/** Calm opening screen: logo fades in and settles, floats very gently over one soft pulse, thin loading bar; then straight to the menu (signed in) or login. */
export default function Splash() {
  const router = useRouter();
  const pop = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(pop, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
    Animated.timing(bar, { toValue: 1, duration: MIN_MS, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: ND }).start();
    const f = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      Animated.timing(float, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
    ]));
    const p = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2400, easing: Easing.out(Easing.quad), useNativeDriver: ND }));
    f.start(); p.start();
    return () => { f.stop(); p.stop(); };
  }, [pop, float, pulse, bar]);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      let signedIn = false;
      try { signedIn = !!(await supabase.auth.getSession()).data.session; } catch { signedIn = false; }
      const wait = Math.max(0, MIN_MS + 200 - (Date.now() - started));
      setTimeout(() => { if (alive) router.replace(signedIn ? '/menu' : '/login'); }, wait);
    })();
    return () => { alive = false; };
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center', gap: 40 }}>
      <Animated.View style={{ width: 240, height: 240, alignItems: 'center', justifyContent: 'center', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }] }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 2, borderColor: 'rgba(26,13,11,0.22)',
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.3] }) }] }} />
        <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }] }}>
          <Image source={require('../assets/logo.png')} style={{ width: 180, height: 180 }} resizeMode="contain" accessibilityLabel="Gochit's" />
        </Animated.View>
      </Animated.View>
      <View style={{ width: 150, height: 4, borderRadius: 2, backgroundColor: 'rgba(26,13,11,0.16)', overflow: 'hidden' }}>
        <Animated.View style={{ width: 150, height: 4, borderRadius: 2, backgroundColor: colors.ink, transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-150, 0] }) }] }} />
      </View>
    </View>
  );
}
