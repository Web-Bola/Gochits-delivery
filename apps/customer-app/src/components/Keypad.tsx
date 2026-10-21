import { Pressable, Text, View } from 'react-native';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Icon } from './Icon';

/** On-screen number pad (3x4) used on the phone and SMS code screens. */
export function Keypad({ onDigit, onBack }: { onDigit: (d: string) => void; onBack: () => void }) {
  const key = (label: string, onPress: () => void, node?: React.ReactNode, a11y?: string) => (
    <Pressable key={label} accessibilityRole="button" accessibilityLabel={a11y ?? label} onPress={onPress}
      style={({ pressed }) => ({ flex: 1, height: 52, borderRadius: 12, backgroundColor: pressed ? theme.surface2 : theme.surface, alignItems: 'center', justifyContent: 'center' })}>
      {node ?? <Text style={{ fontFamily: fontFamily.semibold, fontSize: 24, color: theme.text }}>{label}</Text>}
    </Pressable>
  );
  const rows = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']];
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => <View key={r[0]} style={{ flexDirection: 'row', gap: 8 }}>{r.map((d) => key(d, () => onDigit(d)))}</View>)}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }} />
        {key('0', () => onDigit('0'))}
        {key('⌫', onBack, <Icon name="back" size={24} color={colors.muted} />, 'წაშლა')}
      </View>
    </View>
  );
}
