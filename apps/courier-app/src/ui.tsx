import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';

export const gel = (tetri: number) => `₾${(tetri / 100).toFixed(2)}`;

const PATHS = {
  phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z',
  map: 'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  out: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
} as const;
export function Icon({ name, size = 22, color = colors.ink }: { name: keyof typeof PATHS; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d={PATHS[name]} /></Svg>;
}

export function T({ children, size = 15, weight = 'regular', color = theme.text, style }: { children: ReactNode; size?: number; weight?: 'regular' | 'semibold' | 'extrabold'; color?: string; style?: TextStyle }) {
  return <Text style={[{ fontFamily: fontFamily[weight], fontSize: size, color }, style]}>{children}</Text>;
}

export function Btn({ title, onPress, icon, kind = 'primary', busy, disabled, style }: { title: string; onPress: () => void; icon?: keyof typeof PATHS; kind?: 'primary' | 'ghost' | 'green'; busy?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const bg = kind === 'primary' ? colors.yellow : kind === 'green' ? '#2E9E5B' : 'transparent';
  const fg = kind === 'ghost' ? theme.text : kind === 'green' ? colors.white : colors.ink;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={busy || disabled} style={({ pressed }) => [{ minHeight: 54, borderRadius: 16, backgroundColor: bg, borderWidth: kind === 'ghost' ? 1 : 0, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {busy ? <ActivityIndicator color={fg} /> : (<>{icon ? <Icon name={icon} color={fg} /> : null}<T size={16} weight="extrabold" color={fg}>{title}</T></>)}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ backgroundColor: theme.surface, borderRadius: 22, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 12 }, style]}>{children}</View>;
}
