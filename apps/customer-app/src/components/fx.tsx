import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, View, type PressableProps, type ViewStyle } from 'react-native';
import { colors } from '@gochits/ui-tokens';

/** Native driver does not exist on web. */
export const ND = Platform.OS !== 'web';

/** True when the OS asks for reduced motion: loops and big movements are skipped. */
export function useReduceMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setR(v)).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setR);
    return () => { alive = false; sub.remove(); };
  }, []);
  return r;
}

/** Gentle up/down float, forever. */
export function Float({ children, amplitude = 10, duration = 2400, delay = 0, style }: { children: ReactNode; amplitude?: number; duration?: number; delay?: number; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
      Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay, reduce]);
  return <Animated.View style={[style, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -amplitude] }) }] }]}>{children}</Animated.View>;
}

/** Expanding ring pulse (radar). */
export function Pulse({ size = 200, color = colors.white, delay = 0 }: { size?: number; color?: string; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 2600, delay, easing: Easing.out(Easing.quad), useNativeDriver: ND }));
    loop.start();
    return () => loop.stop();
  }, [v, delay, reduce]);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: color,
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.9] }) }] }} />
  );
}

/** Scale-down on press, springs back. */
export function PressScale({ children, style, scaleTo = 0.96, ...rest }: PressableProps & { children: ReactNode; style?: ViewStyle; scaleTo?: number }) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (n: number) => Animated.spring(v, { toValue: n, friction: 6, tension: 220, useNativeDriver: ND }).start();
  return (
    <Pressable {...rest} onPressIn={(e) => { to(scaleTo); rest.onPressIn?.(e); }} onPressOut={(e) => { to(1); rest.onPressOut?.(e); }}>
      <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Scale pop whenever `value` changes. */
export function Bump({ value, children, style }: { value: unknown; children: ReactNode; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    Animated.sequence([
      Animated.timing(v, { toValue: 1.18, duration: 110, useNativeDriver: ND }),
      Animated.spring(v, { toValue: 1, friction: 4, tension: 200, useNativeDriver: ND }),
    ]).start();
  }, [value, v]);
  return <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>;
}

/** "+1" that rises and fades each time `trigger` changes. */
export function FloatUp({ trigger, label = '+1' }: { trigger: number; label?: string }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (trigger === 0) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
  }, [trigger, v]);
  return (
    <Animated.Text pointerEvents="none" style={{ position: 'absolute', right: 6, top: 0, fontFamily: 'NotoSansGeorgian_800ExtraBold', fontSize: 20, color: colors.brand,
      opacity: v.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -46] }) }] }}>{label}</Animated.Text>
  );
}

/** Slides up from below when mounted. */
export function SlideUp({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.spring(v, { toValue: 1, friction: 7, tension: 90, useNativeDriver: ND }).start(); }, [v]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) }] }]}>{children}</Animated.View>;
}

/** Pulsing placeholder block while data loads. */
export function Shimmer({ style }: { style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 700, useNativeDriver: ND }),
      Animated.timing(v, { toValue: 0.45, duration: 700, useNativeDriver: ND }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[{ backgroundColor: colors.sand, borderRadius: 16 }, style, { opacity: v }]} />;
}

/** One-shot confetti burst in brand colors. */
export function Confetti({ count = 28 }: { count?: number }) {
  const reduce = useReduceMotion();
  const pieces = useMemo(() => Array.from({ length: count }).map((_, i) => ({
    left: (i / count) * 100 + (Math.random() * 6 - 3), drift: Math.random() * 120 - 60, delay: Math.random() * 500,
    size: 8 + Math.random() * 8, color: [colors.brand, colors.red, colors.orange, '#F1F5FB'][i % 4]!, spin: Math.random() * 720 - 360, round: i % 3 === 0,
  })), [count]);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (!reduce) Animated.timing(v, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: ND }).start(); }, [v, reduce]);
  if (reduce) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <Animated.View key={i} style={{ position: 'absolute', top: -20, left: `${p.left}%`, width: p.size, height: p.size * (p.round ? 1 : 1.6), borderRadius: p.round ? p.size : 2, backgroundColor: p.color,
          opacity: v.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 760 - p.delay / 2] }) }, { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) }, { rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) }] }} />
      ))}
    </View>
  );
}

/** Slow endless rotation (dashed ring behind a hero image). */
export function Spin({ children, duration = 26000, style }: { children?: ReactNode; duration?: number; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: ND }));
    loop.start();
    return () => loop.stop();
  }, [v, duration, reduce]);
  return <Animated.View style={[style, { transform: [{ rotate: v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }]}>{children}</Animated.View>;
}

/** Looping 0..1 value for custom animations (progress bar, drifting seeds). */
export function useLoop(duration: number, delay = 0): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }));
    loop.start();
    return () => loop.stop();
  }, [v, duration, delay, reduce]);
  return v;
}
