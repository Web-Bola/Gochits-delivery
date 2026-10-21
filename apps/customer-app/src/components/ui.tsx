import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fontFamily, minTouch, radius, theme } from '@gochits/ui-tokens';
import { Float, ND, PressScale, useReduceMotion } from './fx';
import { Icon } from './Icon';

const logo = require('../../assets/zyro-logo.png');

/** On web (testing only) the app is shown at phone width, centered. On a phone it fills the screen. */
export function AppFrame({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: '#050A14', alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 430, backgroundColor: theme.bg, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

/** Fade + slide up. `index` staggers lists. Skipped under reduced motion. */
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
    <View style={{ height, overflow: 'hidden', backgroundColor: colors.brand }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={{ flexDirection: 'row', width: 1400, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-28, 0] }) }] }}>
        {Array.from({ length: 100 }).map((_, i) => (
          <View key={i} style={{ width: 14, height, backgroundColor: i % 2 === 0 ? colors.onBrand : colors.brand, transform: [{ skewX: '-40deg' }] }} />
        ))}
      </Animated.View>
    </View>
  );
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  const router = useRouter();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="უკან" onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
      style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="back" size={22} color={theme.text} />
    </Pressable>
  );
}

/** Dark header: optional back button, logo, title, right slot. Thin divider underneath (as in the demo). */
export function Header({ title, subtitle, back, showLogo, right }: { title?: string; subtitle?: string; back?: boolean; showLogo?: boolean; right?: ReactNode }) {
  return (
    <View style={[s.header, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {back ? <BackButton /> : showLogo ? <Image source={logo} style={{ height: 32, width: 70 }} resizeMode="contain" accessibilityLabel="ZYRO" /> : <View />}
        {right}
      </View>
      {title && <Text style={s.h1} accessibilityRole="header">{title}</Text>}
      {subtitle && <Text style={s.sub}>{subtitle}</Text>}
    </View>
  );
}

/** Login / OTP: navy page, big ZYRO logo that floats gently, tagline, content below. */
export function Hero({ children, small }: { children: ReactNode; small?: boolean }) {
  const w = small ? 150 : 200;
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ height: small ? 190 : 250, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Float amplitude={5} duration={2400}><Image source={logo} style={{ width: w, height: w * 0.46 }} resizeMode="contain" accessibilityLabel="ZYRO" /></Float>
        <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: theme.muted, letterSpacing: 0.4 }}>ყველაფერი, მიტანით</Text>
      </View>
      <View style={{ flex: 1, padding: 20, gap: 14 }}>{children}</View>
    </View>
  );
}

export function Screen({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  return <View style={[s.screen, scroll && { padding: 0 }]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={s.h1} accessibilityRole="header">{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[s.body, muted && { color: theme.muted }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text accessibilityLiveRegion="polite" style={{ color: '#D63A2F', fontFamily: fontFamily.semibold, fontSize: 13 }}>{children}</Text>;
}

export function Card({ children, style, selected }: { children: ReactNode; style?: ViewStyle; selected?: boolean }) {
  return <View style={[s.card, selected && { borderColor: colors.brand }, style]}>{children}</View>;
}

/** red = main action, ink = yellow secondary action, outline = quiet. */
export function Button({ title, onPress, disabled, variant = 'red' }: { title: string; onPress: () => void; disabled?: boolean; variant?: 'red' | 'ink' | 'outline' | 'outlineDark' }) {
  const bg = variant === 'red' || variant === 'ink' ? colors.brand : 'transparent';
  const fg = variant === 'red' ? colors.onBrand : variant === 'ink' ? colors.onBrand : variant === 'outlineDark' ? colors.onBrand : theme.text;
  return (
    <PressScale accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled} scaleTo={0.97}
      style={{ ...s.btn, backgroundColor: bg, opacity: disabled ? 0.45 : 1,
        ...(variant === 'red' && !disabled ? { shadowColor: colors.brand, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } } : {}),
        ...(variant === 'ink' && !disabled ? { shadowColor: colors.brand, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } } : {}),
        ...(variant === 'outline' ? { borderWidth: 2, borderColor: theme.border } : {}),
        ...(variant === 'outlineDark' ? { borderWidth: 2, borderColor: 'rgba(11,23,36,0.45)' } : {}) }}>
      <Text style={[s.btnText, { color: fg }]}>{title}</Text>
    </PressScale>
  );
}

/** Friendly empty / error state: round icon, title, hint, optional action. */
export function StateView({ icon, title, hint, actionTitle, onAction, tone = 'empty' }: { icon: Parameters<typeof Icon>[0]['name']; title: string; hint?: string; actionTitle?: string; onAction?: () => void; tone?: 'empty' | 'error' }) {
  return (
    <View style={{ alignItems: 'center', gap: 12, paddingTop: 50, paddingHorizontal: 12 }} accessibilityLiveRegion="polite">
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: tone === 'error' ? 2 : 0, borderColor: colors.red }}>
        <Icon name={icon} size={44} color={tone === 'error' ? colors.red : colors.brand} />
      </View>
      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: theme.text, textAlign: 'center' }}>{title}</Text>
      {hint ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.muted, textAlign: 'center', lineHeight: 20 }}>{hint}</Text> : null}
      {actionTitle && onAction ? <View style={{ alignSelf: 'stretch', marginTop: 6 }}><Button title={actionTitle} onPress={onAction} variant="ink" /></View> : null}
    </View>
  );
}

export function Field({ label, ...p }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={theme.muted} {...p} style={[s.input, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 20, gap: 14 },
  header: { backgroundColor: theme.bg, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, gap: 10 },
  h1: { fontFamily: fontFamily.extrabold, fontSize: 24, color: theme.text },
  sub: { fontFamily: fontFamily.regular, fontSize: 13, color: theme.muted, lineHeight: 19 },
  body: { fontFamily: fontFamily.regular, fontSize: 15, color: theme.text, lineHeight: 22 },
  card: { backgroundColor: theme.surface, borderRadius: radius.card, padding: 16, gap: 6, borderWidth: 2, borderColor: theme.border },
  btn: { minHeight: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnText: { fontFamily: fontFamily.extrabold, fontSize: 17 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, color: theme.text },
  input: { minHeight: Math.max(52, minTouch), borderWidth: 2, borderColor: theme.border, borderRadius: radius.input, paddingHorizontal: 14, fontFamily: fontFamily.semibold, fontSize: 16, color: theme.text, backgroundColor: theme.surface },
});
