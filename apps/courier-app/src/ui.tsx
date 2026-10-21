import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fontFamily } from '@gochits/ui-tokens';

/** Clean light courier palette (Glovo / Wolt style): white panels over a map, one yellow accent, green for "go". */
export const c = {
  bg: '#F3F3F1', sheet: '#FFFFFF', ink: '#141414', muted: '#6F6F6B', line: '#E7E7E3', soft: '#F3F3F1',
  yellow: colors.brand, yellowSoft: '#DDEFE8', green: '#12A150', greenSoft: '#E4F6EB', red: '#D92D20', redSoft: '#FDECEA',
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
} as const;
export type IconName = keyof typeof PATHS;
export function Icon({ name, size = 22, color = c.ink }: { name: IconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d={PATHS[name]} /></Svg>;
}

export function T({ children, size = 15, weight = 'regular', color = c.ink, style }: { children: ReactNode; size?: number; weight?: 'regular' | 'semibold' | 'extrabold'; color?: string; style?: TextStyle }) {
  return <Text style={[{ fontFamily: fontFamily[weight], fontSize: size, color }, style]}>{children}</Text>;
}

export function Btn({ title, onPress, icon, kind = 'primary', busy, disabled, style }: { title: string; onPress: () => void; icon?: IconName; kind?: 'primary' | 'soft' | 'dark'; busy?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const bg = kind === 'primary' ? c.yellow : kind === 'dark' ? c.ink : c.soft;
  const fg = kind === 'soft' ? c.ink : '#fff';
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={busy || disabled} style={({ pressed }) => [{ minHeight: 58, borderRadius: 16, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : (<>{icon ? <Icon name={icon} color={fg} size={22} /> : null}<T size={17} weight="extrabold" color={fg}>{title}</T></>)}
    </Pressable>
  );
}

/** Round icon button used on the map and next to the customer. */
export function RoundBtn({ icon, onPress, label, bg = c.sheet, fg = bg === c.yellow ? '#fff' : c.ink, size = 48, disabled }: { icon: IconName; onPress: () => void; label: string; bg?: string; fg?: string; size?: number; disabled?: boolean }) {
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
