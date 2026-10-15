import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily } from '@gochits/ui-tokens';
import { Body, Button, Card, FadeIn, Header, Screen } from '../src/components/ui';
import { useCart } from '../src/state/cart';

function Qty({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label === '+' ? 'მეტი' : 'ნაკლები'} onPress={onPress}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? colors.yellow : 'transparent' })}>
      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: colors.ink, marginTop: -2 }}>{label}</Text>
    </Pressable>
  );
}

export default function Cart() {
  const router = useRouter();
  const { lines, add, remove, subtotal } = useCart();
  return (
    <Screen scroll>
      <Header back title={ka.cart.title} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        {lines.length === 0 && <Body muted>{ka.cart.empty}</Body>}
        {lines.map((l, i) => (
          <FadeIn key={l.productId} index={i}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.ink }}>{l.name}</Text>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.red }}>{formatGel(l.unitPriceTetri * l.quantity)}</Text>
              </View>
              <Qty label="−" onPress={() => remove(l.productId)} />
              <Text style={{ fontFamily: fontFamily.extrabold, minWidth: 22, textAlign: 'center', fontSize: 16 }}>{l.quantity}</Text>
              <Qty label="+" onPress={() => add({ productId: l.productId, name: l.name, unitPriceTetri: l.unitPriceTetri })} />
            </Card>
          </FadeIn>
        ))}
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Body muted>{ka.cart.subtotal}</Body><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.ink }}>{formatGel(subtotal)}</Text>
          </View>
          <Body muted>{ka.branch.hint}</Body>
        </Card>
        <Button title={ka.cart.checkout} disabled={lines.length === 0} onPress={() => router.push('/checkout')} />
      </ScrollView>
    </Screen>
  );
}
