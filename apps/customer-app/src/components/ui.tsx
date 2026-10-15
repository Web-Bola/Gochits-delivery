import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fontFamily, minTouch, radius } from '@gochits/ui-tokens';

export function Screen({ children, yellow }: { children: ReactNode; yellow?: boolean }) {
  return <View style={[s.screen, yellow && { backgroundColor: colors.yellow }]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={s.h1} accessibilityRole="header">{children}</Text>;
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <Text style={[s.body, muted && { color: colors.muted }]}>{children}</Text>;
}

export function Button({ title, onPress, disabled, variant = 'red' }: { title: string; onPress: () => void; disabled?: boolean; variant?: 'red' | 'ink' | 'outline' }) {
  const bg = variant === 'red' ? colors.red : variant === 'ink' ? colors.ink : 'transparent';
  const fg = variant === 'red' ? colors.white : variant === 'ink' ? colors.yellow : colors.ink;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, variant === 'outline' && { borderWidth: 2, borderColor: colors.ink }]}>
      <Text style={[s.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, ...p }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...p} style={s.input} />
    </View>
  );
}

export function Stripe() {
  return <View style={{ height: 8, backgroundColor: colors.ink }} />;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, padding: 20, gap: 14 },
  h1: { fontFamily: fontFamily.extrabold, fontSize: 26, color: colors.ink },
  body: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.ink, lineHeight: 22 },
  btn: { minHeight: 56, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  btnText: { fontFamily: fontFamily.extrabold, fontSize: 17 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.ink },
  input: { minHeight: Math.max(50, minTouch), borderWidth: 2, borderColor: colors.sand, borderRadius: radius.input, paddingHorizontal: 14, fontFamily: fontFamily.semibold, fontSize: 16, color: colors.ink, backgroundColor: colors.white },
});
