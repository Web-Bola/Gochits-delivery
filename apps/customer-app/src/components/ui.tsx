import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontFamily, minTouch, radius } from '@gochits/ui-tokens';
import { Float, ND, Pulse, PressScale, useReduceMotion } from './fx';
import { menuImages } from '../lib/menuImages';

const logo = require('../../assets/logo.png');

/** On web (testing only) the app is shown at phone width, centered. On a phone it fills the screen. */
export function AppFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: colors.yellowSoft, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 430, backgroundColor: colors.cream, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 30 }}>{children}</View>
    </View>
  );
}

/** Fade + slide up. Respects nothing fancy: short, one-shot. `index` staggers lists. */
export function FadeIn({ children, index = 0, style }: { children: ReactNode; index?: number; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    Animated.timing(v, { toValue: 1, duration: 480, delay: Math.min(index, 8) * 70, easing: Easing.out(Easing.back(1.2)), useNativeDriver: ND }).start();
  }, [v, index, reduce]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>{children}</Animated.View>
  );
}

/** Black and yellow hazard stripe from the Facebook cover. Slowly scrolls (still when reduced motion is on). */
export function Stripe({ height = 12 }: { height?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: ND }));
    loop.start();
    return () => loop.stop();
  }, [v, reduce]);
  return (
    <View style={{ height, overflow: 'hidden', backgroundColor: colors.yellow }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ flexDirection: 'row', width: 1400, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) }] }}>
        {Array.from({ length: 100 }).map((_, i) => (
          <View key={i} style={{ width: 14, height, backgroundColor: i % 2 === 0 ? colors.ink : colors.yellow, transform: [{ skewX: '-40deg' }] }} />
        ))}
      </Animated.View>
    </View>
  );
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="უკან" onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.yellow, fontSize: 22, fontFamily: fontFamily.extrabold, marginTop: -2 }}>←</Text>
    </Pressable>
  );
}

/** Yellow header: optional back button, logo or title, optional right slot. */
export function Header({ title, subtitle, back, showLogo, right }: { title?: string; subtitle?: string; back?: boolean; showLogo?: boolean; right?: ReactNode }) {
  return (
    <View>
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {back ? <BackButton /> : showLogo ? <Image source={logo} style={{ height: 46, width: 70 }} resizeMode="contain" accessibilityLabel="Gochit's" /> : <View />}
          {right}
        </View>
        {title && <Text style={s.h1} accessibilityRole="header">{title}</Text>}
        {subtitle && <Text style={s.sub}>{subtitle}</Text>}
      </View>
      <Stripe />
    </View>
  );
}

/** Big yellow hero with the logo, radar rings and floating burgers (login, otp). Content sits in a white sheet below. */
export function Hero({ children, small }: { children: ReactNode; small?: boolean }) {
  const size = small ? 120 : 180;
  const bubble = (key: string, pos: ViewStyle, d: number, sz: number) => (
    <Float amplitude={12} duration={2000 + d} delay={d} style={{ position: 'absolute', ...pos }}>
      <View style={{ width: sz, height: sz, borderRadius: sz / 2, overflow: 'hidden', borderWidth: 4, borderColor: colors.white, backgroundColor: colors.ink }}>
        {menuImages[key] !== undefined && <Image source={menuImages[key]} style={{ width: '100%', height: '100%' }} />}
      </View>
    </Float>
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.yellow }}>
      <View style={{ alignItems: 'center', justifyContent: 'center', paddingTop: 44, paddingBottom: 24, minHeight: small ? 200 : 290, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: '#FFD83A', top: -80, right: -90 }} />
        <View style={{ position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: colors.orange, opacity: 0.55, bottom: -70, left: -60 }} />
        <Pulse size={size + 30} color={colors.ink} />
        <Pulse size={size + 30} color={colors.red} delay={1300} />
        {bubble('menu/01-double-smashed.jpg', { left: 18, top: 70 }, 0, small ? 54 : 70)}
        {bubble('menu/05-giant-burger.jpg', { right: 20, top: 90 }, 500, small ? 48 : 62)}
        {!small && bubble('menu/04-gochits-burger.jpg', { right: 56, bottom: 22 }, 900, 50)}
        <Float amplitude={8} duration={2200}><Image source={logo} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="Gochit's" /></Float>
      </View>
      <Stripe />
      <View style={{ flex: 1, backgroundColor: colors.white, padding: 24, gap: 14 }}>{children}</View>
    </View>
  );
}

export function Screen({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  return <View style={[s.screen, scroll && { padding: 0 }]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={s.h1dark} accessibilityRole="header">{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[s.body, muted && { color: colors.muted }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text accessibilityLiveRegion="polite" style={{ color: colors.red, fontFamily: fontFamily.semibold, fontSize: 13 }}>{children}</Text>;
}

export function Card({ children, style, selected }: { children: ReactNode; style?: ViewStyle; selected?: boolean }) {
  return <View style={[s.card, selected && { borderColor: colors.red, borderWidth: 3 }, style]}>{children}</View>;
}

export function Button({ title, onPress, disabled, variant = 'red' }: { title: string; onPress: () => void; disabled?: boolean; variant?: 'red' | 'ink' | 'outline' }) {
  const bg = variant === 'red' ? colors.red : variant === 'ink' ? colors.ink : 'transparent';
  const fg = variant === 'red' ? colors.white : variant === 'ink' ? colors.yellow : colors.ink;
  return (
    <PressScale accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled} scaleTo={0.97}
      style={{ ...s.btn, backgroundColor: bg, opacity: disabled ? 0.45 : 1,
        ...(variant === 'red' && !disabled ? { shadowColor: colors.red, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } } : {}),
        ...(variant === 'outline' ? { borderWidth: 2, borderColor: colors.ink } : {}) }}>
      <Text style={[s.btnText, { color: fg }]}>{title}</Text>
    </PressScale>
  );
}

export function Field({ label, ...p }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...p} style={[s.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, padding: 20, gap: 14 },
  header: { backgroundColor: colors.yellow, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, gap: 10 },
  h1: { fontFamily: fontFamily.extrabold, fontSize: 24, color: colors.ink },
  h1dark: { fontFamily: fontFamily.extrabold, fontSize: 24, color: colors.ink },
  sub: { fontFamily: fontFamily.regular, fontSize: 13, color: colors.ink, lineHeight: 19 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.ink, lineHeight: 22 },
  card: { backgroundColor: colors.white, borderRadius: radius.card, padding: 16, gap: 6, borderWidth: 3, borderColor: 'transparent', shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  btn: { minHeight: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnText: { fontFamily: fontFamily.extrabold, fontSize: 17 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.ink },
  input: { minHeight: Math.max(52, minTouch), borderWidth: 2, borderColor: colors.sand, borderRadius: radius.input, paddingHorizontal: 14, fontFamily: fontFamily.semibold, fontSize: 16, color: colors.ink, backgroundColor: colors.white },
});
