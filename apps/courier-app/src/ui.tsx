import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fontFamily } from '@gochits/ui-tokens';

/** Courier palette. Dark counter, paper order tickets, brand yellow and red. */
export const c = {
  bg: '#140E0B', line: '#3A2A24', ink: '#F4EEE6', muted: '#B3A596', yellow: colors.yellow, red: '#D81F26', redText: '#FF7A6B', green: '#4BC27D',
  paper: '#FFF1CC', pInk: '#1A0D0B', pMuted: '#7A6A55', pGreen: '#1F8F4E', pRed: '#C4161C',
} as const;

export const gel = (tetri: number) => `₾${(tetri / 100).toFixed(2)}`;

const PATHS = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
} as const;
export function Icon({ name, size = 22, color = '#F4EEE6' }: { name: keyof typeof PATHS; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><Path d={PATHS[name]} /></Svg>;
}

export function T({ children, size = 15, weight = 'regular', color = c.ink, style }: { children: ReactNode; size?: number; weight?: 'regular' | 'semibold' | 'extrabold'; color?: string; style?: TextStyle }) {
  return <Text style={[{ fontFamily: fontFamily[weight], fontSize: size, color }, style]}>{children}</Text>;
}

/** Black and yellow hazard stripe from the Gochit's cover (static). */
export function Stripe({ height = 10 }: { height?: number }) {
  return (
    <View style={{ height, overflow: 'hidden', backgroundColor: c.yellow }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={{ flexDirection: 'row', width: 1600, marginLeft: -20 }}>
        {Array.from({ length: 110 }).map((_, i) => <View key={i} style={{ width: 14, height, backgroundColor: i % 2 === 0 ? '#1A0D0B' : c.yellow, transform: [{ skewX: '-40deg' }] }} />)}
      </View>
    </View>
  );
}

/** 'ink' = black button with yellow text (on paper), 'primary' = yellow with black text (on the dark counter). */
export function Btn({ title, onPress, icon, kind = 'primary', busy, disabled, style }: { title: string; onPress: () => void; icon?: keyof typeof PATHS; kind?: 'primary' | 'ink' | 'line' | 'lineDark'; busy?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const bg = kind === 'primary' ? c.yellow : kind === 'ink' ? c.pInk : 'transparent';
  const fg = kind === 'primary' ? c.pInk : kind === 'ink' ? c.yellow : kind === 'line' ? c.pInk : c.ink;
  const border = kind === 'line' ? c.pInk : kind === 'lineDark' ? c.line : bg;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={busy || disabled} style={({ pressed }) => [{ minHeight: 58, borderRadius: 8, borderWidth: 2, borderColor: border, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 14, opacity: disabled ? 0.35 : pressed ? 0.85 : 1 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : (<>{icon ? <Icon name={icon} color={fg} size={22} /> : null}<T size={17} weight="extrabold" color={fg}>{title}</T></>)}
    </Pressable>
  );
}

/** Paper order ticket with square corners. Use <Perf /> inside to cut it into sections. */
export function Ticket({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ backgroundColor: c.paper, borderRadius: 6, paddingVertical: 16, gap: 14 }, style]}>{children}</View>;
}
export function Pad({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ paddingHorizontal: 16, gap: 12 }, style]}>{children}</View>;
}
/** Perforation: dashed line with half-circle notches at both edges. */
export function Perf() {
  return (
    <View style={{ height: 20, justifyContent: 'center' }}>
      <View style={{ borderTopWidth: 2, borderStyle: 'dashed', borderColor: c.pMuted, marginHorizontal: 14, opacity: 0.6 }} />
      <View style={{ position: 'absolute', left: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: c.bg }} />
      <View style={{ position: 'absolute', right: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: c.bg }} />
    </View>
  );
}
/** Rubber-stamp label. */
export function Stamp({ text, color }: { text: string; color: string }) {
  return (
    <View style={{ borderWidth: 3, borderColor: color, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, transform: [{ rotate: '-3deg' }] }}>
      <T size={16} weight="extrabold" color={color}>{text}</T>
    </View>
  );
}
/** Receipt line: label ........ value */
export function Line({ label, value, strong, color = c.pInk }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <T size={strong ? 18 : 16} weight={strong ? 'extrabold' : 'regular'} color={c.pInk}>{label}</T>
      <View style={{ flex: 1, borderBottomWidth: 2, borderStyle: 'dotted', borderColor: c.pMuted, marginHorizontal: 6, marginBottom: 6 }} />
      <T size={strong ? 24 : 17} weight="extrabold" color={color}>{value}</T>
    </View>
  );
}
