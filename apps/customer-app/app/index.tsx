import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { supabase } from '../src/lib/supabase';
import { art } from '../src/lib/art';
import { ND, useReduceMotion } from '../src/components/fx';

const MIN_MS = 2200;
const BAR = 150;

/** Four-point star that twinkles: grows, brightens and fades, then waits for its turn again. */
function Sparkle({ x, y, size, delay, reduce }: { x: number; y: number; size: number; delay: number; reduce: boolean }) {
  const v = useRef(new Animated.Value(reduce ? 0.7 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: ND }),
      Animated.timing(v, { toValue: 0, duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: ND }),
      Animated.delay(900),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, delay, reduce]);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, opacity: v,
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['-30deg', '20deg'] }) }] }}>
      <Svg width={size} height={size} viewBox="0 0 24 24"><Path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z" fill="#0BA79A" /></Svg>
    </Animated.View>
  );
}

/** Ripple ring expanding from the centre, endlessly. */
function Ring({ delay, reduce }: { delay: number; reduce: boolean }) {
  const v = useRef(new Animated.Value(reduce ? 0.5 : 0)).current;
  useEffect(() => {
    if (reduce) return;
    const l = Animated.loop(Animated.sequence([Animated.delay(delay), Animated.timing(v, { toValue: 1, duration: 3200, easing: Easing.out(Easing.quad), useNativeDriver: ND })]));
    l.start(); return () => l.stop();
  }, [v, delay, reduce]);
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', width: 300, height: 300, borderRadius: 150, borderWidth: 1.5, borderColor: colors.brand, opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.35, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 3.2] }) }] }} />;
}

/** Opening screen: logo fades in over the photo and twinkles with sparkles, thin progress bar; then straight to the menu (signed in) or login. */
export default function Splash() {
  const router = useRouter();
  const reduce = useReduceMotion();
  const pop = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(pop, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
    Animated.timing(text, { toValue: 1, duration: 700, delay: 500, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
    Animated.timing(bar, { toValue: 1, duration: MIN_MS, easing: Easing.bezier(0.4, 0, 0.2, 1), useNativeDriver: ND }).start();
  }, [pop, text, bar]);

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
      <LinearGradient colors={['#F5F5F1', '#E8E8E2', '#D5ECE8']} locations={[0, 0.55, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 }}>
        <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center', top: '50%', marginTop: -150 }}>
          <Ring delay={0} reduce={reduce} /><Ring delay={1050} reduce={reduce} /><Ring delay={2100} reduce={reduce} />
        </View>
        <Animated.View style={{ width: 260, height: 130, alignItems: 'center', justifyContent: 'center', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }}>
          <Image source={require('../assets/zyro-logo.png')} style={{ width: 230, height: 106 }} resizeMode="contain" accessibilityLabel="ZYRO" />
          <Sparkle x={62} y={34} size={20} delay={500} reduce={reduce} />
          <Sparkle x={196} y={26} size={26} delay={900} reduce={reduce} />
          <Sparkle x={120} y={98} size={16} delay={1300} reduce={reduce} />
          <Sparkle x={228} y={84} size={18} delay={1700} reduce={reduce} />
          <Sparkle x={30} y={86} size={14} delay={2100} reduce={reduce} />
        </Animated.View>
        <Animated.View style={{ alignItems: 'center', gap: 6, opacity: text }}>
          <Text style={{ fontFamily: fontFamily.semibold, fontSize: 19, color: theme.text }}>Everything, delivered.</Text>
        </Animated.View>
        <View style={{ width: BAR, height: 4, position: 'absolute', bottom: 70, borderRadius: 2, backgroundColor: 'rgba(23,26,27,0.10)', overflow: 'hidden' }}>
          <Animated.View style={{ width: BAR, height: 4, borderRadius: 2, backgroundColor: colors.brand, transform: [{ translateX: bar.interpolate({ inputRange: [0, 1], outputRange: [-BAR, 0] }) }] }} />
        </View>
      </View>
    </View>
  );
}
