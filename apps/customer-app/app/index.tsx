import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { supabase } from '../src/lib/supabase';
import { art } from '../src/lib/art';
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
    Animated.timing(pop, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
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
      setTimeout(() => { if (alive) router.replace(signedIn ? '/home' : '/login'); }, wait);
    })();
    return () => { alive = false; };
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
    <Image source={art.splash!} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%' }} resizeMode="cover" accessibilityElementsHidden />
    <View style={{ flex: 1, backgroundColor: 'rgba(6,14,24,0.35)', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
      <Animated.View style={{ width: 260, height: 200, alignItems: 'center', justifyContent: 'center', opacity: pop, transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>
        <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: 'rgba(56,217,176,0.35)',
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.3] }) }] }} />
        <Animated.View style={{ transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }}>
          <Image source={require('../assets/zyro-logo.png')} style={{ width: 220, height: 101 }} resizeMode="contain" accessibilityLabel="ZYRO" />
        </Animated.View>
      </Animated.View>
      <View style={{ alignItems: 'center', gap: 6, marginTop: -20 }}>
        <Text style={{ fontFamily: fontFamily.semibold, fontSize: 19, color: theme.text }}>Everything, delivered.</Text>
      </View>
      <Text style={{ fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 24, color: theme.text, textAlign: 'center', position: 'absolute', bottom: 120 }}>თბილისის ყველა საყვარელი{'\n'}ადგილი ერთ აპში</Text>
      <View style={{ width: 150, height: 4, position: 'absolute', bottom: 70, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
        <Animated.View style={{ width: 150, height: 4, borderRadius: 2, backgroundColor: colors.brand, transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-150, 0] }) }] }} />
      </View>
    </View>
    </View>
  );
}
