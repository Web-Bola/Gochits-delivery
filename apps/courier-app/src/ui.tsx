import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { Press } from './fx';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { colors, fontFamily } from '@gochits/ui-tokens';

/** Clean light courier palette (Glovo / Wolt style): white panels over a map, one yellow accent, green for "go". */
export const c = {
  bg: '#E8E8E2', sheet: '#F5F5F1', ink: '#171A1B', muted: '#6B7378', line: '#CBCBC3', soft: '#DCDFDA',
  brand: colors.brand, brandDark: '#078A7F', brandSoft: '#D8F1EE', yellowSoft: '#D8F1EE', green: '#12A150', greenSoft: '#DDF1E4', red: '#D92D20', redSoft: '#FBE3E0',
} as const;

export const gel = (tetri: number) => `₾${(tetri / 100).toFixed(2)}`;

const PATHS = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  nav: 'M3 11l18-8-8 18-2-8z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  bag: 'M6 7h12l1 13H5zM9 7a3 3 0 0 1 6 0',
  wallet: 'M3 7a2 2 0 0 1 2-2h14v4M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8H5a2 2 0 0 1-2-2zM16 14h2',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  id: 'M3 6h18v12H3zM5 16c.5-2 5.5-2 6 0M14 10h4M14 14h4',
  pin: 'M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  camera: 'M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4',
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  chev: 'M6 9l6 6 6-6',
  card: 'M3 6h18v12H3zM3 10h18',
} as const;
export type IconName = keyof typeof PATHS;
export function Icon({ name, size = 22, color = c.ink }: { name: IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d={PATHS[name]} /></Svg>;
}

export function T({ children, size = 15, weight = 'regular', color = c.ink, style }: { children: ReactNode; size?: number; weight?: 'regular' | 'semibold' | 'extrabold'; color?: string; style?: TextStyle }) {
  return <Text style={[{ fontFamily: fontFamily[weight], fontSize: size, color }, style]}>{children}</Text>;
}

export function Btn({ title, onPress, icon, kind = 'primary', busy, disabled, style, arrow }: { title: string; onPress: () => void; icon?: IconName; kind?: 'primary' | 'soft' | 'dark'; busy?: boolean; disabled?: boolean; style?: ViewStyle; arrow?: boolean }) {
  const primary = kind === 'primary';
  const bg = primary ? c.brand : kind === 'dark' ? c.ink : c.sheet;
  const fg = kind === 'soft' ? c.ink : '#fff';
  return (
    <Press accessibilityRole="button" onPress={onPress} disabled={busy || disabled} style={[{ minHeight: kind === 'soft' ? 54 : 58, borderRadius: kind === 'soft' ? 27 : 29, overflow: 'hidden', backgroundColor: bg, borderWidth: kind === 'soft' ? 1 : 0, borderColor: c.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, opacity: disabled ? 0.4 : 1 }, primary ? { shadowColor: c.brand, shadowOpacity: 0.38, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 6 } : null, style]}>
      {primary ? <LinearGradient colors={['#2FC4B6', '#0BA79A', '#078A7F']} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /> : null}
      {busy ? <ActivityIndicator color={fg} /> : (<>{icon ? <Icon name={icon} color={fg} size={22} /> : null}<T size={16.5} weight="extrabold" color={fg}>{title}</T>{arrow ? <T size={22} weight="extrabold" color={fg}>→</T> : null}</>)}
    </Press>
  );
}

/** Round icon button used on the map and next to the customer. */
export function RoundBtn({ icon, onPress, label, bg = c.sheet, fg = c.ink, size = 48, disabled }: { icon: IconName; onPress: () => void; label: string; bg?: string; fg?: string; size?: number; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}>
      <Icon name={icon} color={fg} size={size * 0.45} />
    </Pressable>
  );
}

export function Pill({ children, bg = c.soft, fg = c.ink }: { children: ReactNode; bg?: string; fg?: string }) {
  return <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><T size={14} weight="extrabold" color={fg}>{children as string}</T></View>;
}

export function Divider() { return <View style={{ height: 1, backgroundColor: c.line }} />; }

/** Soft teal-bordered card used across the new design. */
export const card: ViewStyle = { backgroundColor: c.sheet, borderWidth: 1, borderColor: 'rgba(11,167,154,0.16)', borderRadius: 20 };

/** Screen background used by the onboarding screens. */
export function Bg({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center' }}>
      <LinearGradient colors={['#DDE0DB', '#E8E8E2']} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, width: '100%', maxWidth: 480 }}>{children}</View>
    </View>
  );
}

export function Badge({ children }: { children: string }) {
  return <View style={{ backgroundColor: 'rgba(11,167,154,0.14)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}><T size={11} weight="extrabold" color={c.brand} style={{ letterSpacing: 0.5 }}>{children}</T></View>;
}
