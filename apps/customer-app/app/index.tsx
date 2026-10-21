import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { supabase } from '../src/lib/supabase';
import { art } from '../src/lib/art';
import { ND, useReduceMotion } from '../src/components/fx';

const MIN_MS = 2200;
const BAR = 180;

/** Opening screen: photo slowly zooms, logo springs in inside a glowing double ripple with three light dots orbiting it, tagline fades up, glowing progress bar with a travelling shine; then straight to the menu (signed in) or login. */
export default function Splash() {
  const router = useRouter();
  const reduce = useReduceMotion();
  const zoom = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 70, useNativeDriver: ND }).start();
    Animated.timing(text, { toValue: 1, duration: 700, delay: 600, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
    Animated.timing(bar, { toValue: 1, duration: MIN_MS, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: ND }).start();
    if (reduce) return;
    const loops = [
      Animated.timing(zoom, { toValue: 1, duration: 7000, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
      Animated.loop(Animated.timing(ripple, { toValue: 1, duration: 2200, easing: Easing.out(Easing.cubic), useNativeDriver: ND })),
      Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 3200, easing: Easing.linear, useNativeDriver: ND })),
      Animated.loop(Animated.timing(shine, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: ND })),
    ];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [reduce, zoom, pop, text, ripple, orbit, bar, shine]);

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

  const dots = [0, 120, 240];
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, overflow: 'hidden' }}>
      <Animated.Image source={art.splash!} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, width: '100%', height: '100%', transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }} resizeMode="cover" accessibilityElementsHidden />
      <LinearGradient colors={['rgba(6,14,24,0.15)', 'rgba(6,14,24,0.5)', 'rgba(6,14,24,0.85)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="none" />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 280, height: 280, alignItems: 'center', justifyContent: 'center' }}>
          {[0, 0.5].map((d) => (
            <Animated.View key={d} pointerEvents="none" style={{ position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 2, borderColor: colors.brand,
              opacity: ripple.interpolate({ inputRange: [0, d, d + 0.01, 1], outputRange: [0, 0, 0.7, 0], extrapolate: 'clamp' }),
              transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.45] }) }] }} />
          ))}
          <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 230, height: 230, transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
            {dots.map((deg) => (
              <View key={deg} style={{ position: 'absolute', left: 115 - 5, top: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: '#7DF2D6', shadowColor: colors.brand, shadowOpacity: 1, shadowRadius: 10,
                transform: [{ translateX: Math.sin((deg * Math.PI) / 180) * 115 }, { translateY: 115 - Math.cos((deg * Math.PI) / 180) * 115 }] }} />
            ))}
          </Animated.View>
          <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
            <Image source={require('../assets/zyro-logo.png')} style={{ width: 220, height: 101 }} resizeMode="contain" accessibilityLabel="ZYRO" />
          </Animated.View>
        </View>
        <Animated.View style={{ alignItems: 'center', gap: 6, marginTop: 6, opacity: text, transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          <Text style={{ fontFamily: fontFamily.semibold, fontSize: 19, color: theme.text }}>Everything, delivered.</Text>
          <Text style={{ fontFamily: fontFamily.semibold, fontSize: 16, lineHeight: 24, color: theme.text, textAlign: 'center', marginTop: 4 }}>თბილისის ყველა საყვარელი{'\n'}ადგილი ერთ აპში</Text>
        </Animated.View>
        <View style={{ width: BAR, height: 6, position: 'absolute', bottom: 70, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <Animated.View style={{ width: BAR, height: 6, borderRadius: 3, overflow: 'hidden', transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-BAR, 0] }) }] }}>
            <LinearGradient colors={['#7DF2D6', '#38D9B0', '#2CC9A2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
            <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: 40, backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-40, BAR] }) }, { skewX: '-20deg' }] }} />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}
