import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

const nd = Platform.OS !== 'web';

/** Fade + rise on mount. `delay` staggers siblings. */
export function FadeIn({ children, delay = 0, from = 18, style }: { children: ReactNode; delay?: number; from?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 480, delay, easing: Easing.out(Easing.cubic), useNativeDriver: nd }).start(); }, [v, delay]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }] }]}>{children}</Animated.View>;
}

/** Slides up from the bottom (offer sheet). Re-runs when `k` changes. */
export function SlideUp({ children, k, style }: { children: ReactNode; k?: string; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { v.setValue(0); Animated.spring(v, { toValue: 1, friction: 9, tension: 60, useNativeDriver: nd }).start(); }, [v, k]);
  return <Animated.View style={[style, { opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}>{children}</Animated.View>;
}

/** Soft expanding ring behind a dot / button. */
export function Pulse({ size = 14, color }: { size?: number; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: nd }));
    a.start(); return () => a.stop();
  }, [v]);
  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size, backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }] }} />
      <Animated.View style={{ width: size * 0.7, height: size * 0.7, borderRadius: size, backgroundColor: color }} />
    </Animated.View>
  );
}

/** Gentle breathing scale for attention-grabbing elements (new order). */
export function Breathe({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: nd }), Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: nd })]));
    a.start(); return () => a.stop();
  }, [v]);
  return <Animated.View style={[style, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }] }]}>{children}</Animated.View>;
}

/** Pressable that squishes slightly while pressed. */
export function Press({ children, onPress, disabled, style, ...rest }: { children: ReactNode; onPress?: () => void; disabled?: boolean; style?: StyleProp<ViewStyle>; accessibilityRole?: 'button' | 'tab'; accessibilityLabel?: string }) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (x: number) => Animated.spring(v, { toValue: x, friction: 6, tension: 220, useNativeDriver: nd }).start();
  return (
    <Pressable {...rest} disabled={disabled} onPress={onPress} onPressIn={() => to(0.96)} onPressOut={() => to(1)}>
      <Animated.View style={[style, { transform: [{ scale: v }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Expanding glow ring (pending screen, online dot). */
export function Glow({ size, children, color }: { size: number; children: ReactNode; color: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: nd }), Animated.timing(v, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: nd })]));
    a.start(); return () => a.stop();
  }, [v]);
  return (
    <Animated.View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.3] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }] }} />
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: color, backgroundColor: 'rgba(11,167,154,0.12)', alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </Animated.View>
  );
}
