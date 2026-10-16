import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@gochits/ui-tokens';
import { supabase } from '../src/lib/supabase';
import { ND, useReduceMotion } from '../src/components/fx';

const MIN_MS = 2100;

/** Opening screen from the design: yellow, logo bobbing inside a rotating dashed ring with orbiting dots, loading bar; then straight to the menu (signed in) or login. */
export default function Splash() {
  const router = useRouter();
  const reduce = useReduceMotion();
  const pop = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const armA = useRef(new Animated.Value(0)).current;
  const armB = useRef(new Animated.Value(0)).current;
  const armC = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 5, tension: 60, useNativeDriver: ND }).start();
    Animated.timing(bar, { toValue: 1, duration: MIN_MS, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: ND }).start();
    if (reduce) return;
    const spin = (v: Animated.Value, ms: number) => { const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: ND })); a.start(); return a; };
    const b = Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }), Animated.timing(bob, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.sin), useNativeDriver: ND })]));
    b.start();
    const loops = [spin(ring, 14000), spin(armA, 3000), spin(armB, 4600), spin(armC, 6000), b];
    return () => loops.forEach((l) => l.stop());
  }, [pop, bob, ring, armA, armB, armC, bar, reduce]);

  useEffect(() => {
    let alive = true;
    const started = Date.now();
    (async () => {
      let signedIn = false;
      try { signedIn = !!(await supabase.auth.getSession()).data.session; } catch { signedIn = false; }
      const wait = Math.max(0, MIN_MS + 250 - (Date.now() - started));
      setTimeout(() => { if (alive) router.replace(signedIn ? '/menu' : '/login'); }, wait);
    })();
    return () => { alive = false; };
  }, [router]);

  const turn = (v: Animated.Value, dir: 1 | -1 = 1, from = 0) => ({ transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: [`${from}deg`, `${from + dir * 360}deg`] }) }] });
  const arm = (v: Animated.Value, dot: number, color: string, dir: 1 | -1 = 1, from = 0) => (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }, turn(v, dir, from)]}>
      <View style={{ position: 'absolute', left: '50%', top: -dot / 2, width: dot, height: dot, marginLeft: -dot / 2, borderRadius: dot / 2, backgroundColor: color }} />
    </Animated.View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center', gap: 34 }}>
      <Animated.View style={{ width: 250, height: 250, alignItems: 'center', justifyContent: 'center', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }}>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderRadius: 125, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(26,13,11,0.28)' }, turn(ring)]} />
        {arm(armA, 14, colors.red)}{arm(armB, 10, colors.ink, -1)}{arm(armC, 8, colors.white, 1, 120)}
        <Animated.View style={{ transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) }] }}>
          <Image source={require('../assets/logo.png')} style={{ width: 170, height: 170 }} resizeMode="contain" accessibilityLabel="Gochit's" />
        </Animated.View>
      </Animated.View>
      <View style={{ width: 180, height: 6, borderRadius: 3, backgroundColor: 'rgba(26,13,11,0.18)', overflow: 'hidden' }}>
        <Animated.View style={{ width: 180, height: 6, borderRadius: 3, backgroundColor: colors.ink, transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-180, 0] }) }] }} />
      </View>
    </View>
  );
}
