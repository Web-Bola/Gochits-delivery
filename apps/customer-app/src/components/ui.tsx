import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, TextInput, View, type ImageSourcePropType, type TextInputProps, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontFamily, minTouch, radius, theme } from '@gochits/ui-tokens';
import { Float, ND, PressScale, useReduceMotion } from './fx';
import { Icon } from './Icon';
import { Aurora } from './Aurora';

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
export function Header({ title, subtitle, back, right }: { title?: string; subtitle?: string; back?: boolean; showLogo?: boolean; right?: ReactNode }) {
  return (
    <View style={[s.header, { paddingTop: 14, paddingBottom: 12, gap: 6 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ minWidth: 44 }}>{back ? <BackButton /> : null}</View>
        <Image source={logo} style={{ height: 44, width: 96 }} resizeMode="contain" accessibilityLabel="ZYRO" />
        <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
      </View>
      {title && <Text style={[s.h1, { fontSize: 26, marginTop: 4 }]} accessibilityRole="header">{title}</Text>}
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

/** Main action = mint gradient pill (optional arrow), outline = quiet. */
export function Button({ title, onPress, disabled, variant = 'red', arrow }: { title: string; onPress: () => void; disabled?: boolean; variant?: 'red' | 'ink' | 'outline' | 'outlineDark'; arrow?: boolean }) {
  const solid = variant === 'red' || variant === 'ink';
  const fg = solid || variant === 'outlineDark' ? colors.onBrand : theme.text;
  const inner = (
    <>
      <Text style={[s.btnText, { color: fg }]}>{title}</Text>
      {arrow ? <View style={{ position: 'absolute', right: 20 }}><Icon name="arrow" size={22} color={fg} /></View> : null}
    </>
  );
  return (
    <PressScale accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled} scaleTo={0.97}
      style={{ ...s.btn, opacity: disabled ? 0.45 : 1, paddingHorizontal: 0, overflow: 'hidden',
        ...(solid && !disabled ? { shadowColor: colors.brand, shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } } : {}),
        ...(variant === 'outline' ? { borderWidth: 1.5, borderColor: theme.border } : {}),
        ...(variant === 'outlineDark' ? { borderWidth: 2, borderColor: 'rgba(11,23,36,0.45)' } : {}) }}>
      {solid ? (
        <LinearGradient colors={['#7DF2D6', '#38D9B0', '#2CC9A2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>{inner}</LinearGradient>
      ) : inner}
    </PressScale>
  );
}

/** Wide mint call-to-action bar: icon + label on the left, price and arrow on the right (cart, product, checkout). */
export function CtaBar({ title, price, icon, onPress, disabled, divider }: { title: string; price?: string; icon?: Parameters<typeof Icon>[0]['name']; onPress: () => void; disabled?: boolean; divider?: boolean }) {
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={price ? `${title} ${price}` : title} accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled} scaleTo={0.98}
      style={{ height: 58, borderRadius: 29, overflow: 'hidden', opacity: disabled ? 0.45 : 1, shadowColor: colors.brand, shadowOpacity: disabled ? 0 : 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }}>
      <LinearGradient colors={['#7DF2D6', '#38D9B0', '#2CC9A2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 22, paddingRight: 10, gap: 12 }}>
        {icon ? <Icon name={icon} size={24} color={colors.onBrand} /> : null}
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.onBrand }}>{title}</Text>
        {divider ? <View style={{ width: 1, height: 26, backgroundColor: 'rgba(11,23,36,0.25)' }} /> : null}
        {price ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.onBrand }}>{price}</Text> : null}
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.onBrand, alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow" size={20} color={colors.brand} /></View>
      </LinearGradient>
    </PressScale>
  );
}

/** Top row used on inner screens: round back button, ZYRO logo in the middle, optional right slot (same width as the back button keeps the logo centered). */
export function TopBar({ right, noBack }: { right?: ReactNode; noBack?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 }}>
      <View style={{ minWidth: 44 }}>{noBack ? null : <BackButton />}</View>
      <Image source={logo} style={{ height: 44, width: 96 }} resizeMode="contain" accessibilityLabel="ZYRO" />
      <View style={{ minWidth: 44, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/** Dark navy backdrop with soft glows. `source` is a food photo (when provided) shown under a dark fade. */
export function Backdrop({ source, children, fade = 0.55 }: { source?: ImageSourcePropType; children: ReactNode; fade?: number }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {source ? <Image source={source} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '62%', width: '100%' }} resizeMode="cover" accessibilityElementsHidden /> : <Aurora />}
      <LinearGradient colors={['rgba(6,14,24,0.15)', `rgba(6,14,24,${fade})`, theme.bg]} locations={[0, 0.45, 0.8]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} pointerEvents="none" />
      {children}
    </View>
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
  card: { backgroundColor: theme.surface, borderRadius: radius.card, padding: 16, gap: 6, borderWidth: 1, borderColor: 'rgba(56,217,176,0.14)' },
  btn: { minHeight: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnText: { fontFamily: fontFamily.extrabold, fontSize: 17 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, color: theme.text },
  input: { minHeight: Math.max(52, minTouch), borderWidth: 2, borderColor: theme.border, borderRadius: radius.input, paddingHorizontal: 14, fontFamily: fontFamily.semibold, fontSize: 16, color: theme.text, backgroundColor: theme.surface },
});
