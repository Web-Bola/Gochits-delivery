import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Icon } from './Icon';

const KA: Record<string, string> = { '2': 'აბგ', '3': 'დევ', '4': 'ზთი', '5': 'კლმ', '6': 'ნოპ', '7': 'ჟრს', '8': 'ტუფ', '9': 'ქღშ' };
const EN: Record<string, string> = { '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL', '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ' };

/** On-screen number pad (3x4). `confirm` puts a mint arrow key where the empty cell is (SMS code screen). */
export function Keypad({ onDigit, onBack, letters = 'ka', confirm }: { onDigit: (d: string) => void; onBack: () => void; letters?: 'ka' | 'en'; confirm?: { onPress: () => void; enabled: boolean } }) {
  const sub = letters === 'ka' ? KA : EN;
  const cell = { flex: 1, height: 54, borderRadius: 14, alignItems: 'center' as const, justifyContent: 'center' as const };
  const key = (d: string) => (
    <Pressable key={d} accessibilityRole="button" accessibilityLabel={d} onPress={() => onDigit(d)}
      style={({ pressed }) => ({ ...cell, backgroundColor: pressed ? theme.surface2 : theme.surface, borderWidth: 1, borderColor: 'rgba(11,167,154,0.10)' })}>
      <Text style={{ fontFamily: fontFamily.semibold, fontSize: 24, color: theme.text, lineHeight: 28 }}>{d}</Text>
      {sub[d] ? <Text style={{ fontFamily: fontFamily.semibold, fontSize: 9.5, color: theme.muted, letterSpacing: 1.2, marginTop: -1 }}>{sub[d]}</Text> : null}
    </Pressable>
  );
  const back = (
    <Pressable accessibilityRole="button" accessibilityLabel="წაშლა" onPress={onBack} style={({ pressed }) => ({ ...cell, backgroundColor: pressed ? theme.surface2 : 'transparent' })}>
      <Icon name="backspace" size={26} color={theme.text} />
    </Pressable>
  );
  const row = (ds: string[]) => <View key={ds[0]} style={{ flexDirection: 'row', gap: 8 }}>{ds.map(key)}</View>;
  return (
    <View style={{ gap: 8 }}>
      {row(['1', '2', '3'])}{row(['4', '5', '6'])}{row(['7', '8', '9'])}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {confirm ? back : <View style={{ flex: 1 }} />}
        {key('0')}
        {confirm ? (
          <Pressable accessibilityRole="button" accessibilityLabel="გაგრძელება" disabled={!confirm.enabled} onPress={confirm.onPress} style={{ flex: 1, height: 54, borderRadius: 27, overflow: 'hidden', opacity: confirm.enabled ? 1 : 0.5 }}>
            <LinearGradient colors={['#2FC4B6', '#0BA79A']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Icon name="arrow" size={24} color={colors.onBrand} /></LinearGradient>
          </Pressable>
        ) : back}
      </View>
    </View>
  );
}
