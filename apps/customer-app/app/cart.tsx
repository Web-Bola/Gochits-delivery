import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily } from '@gochits/ui-tokens';
import { Body, Button, H1, Screen } from '../src/components/ui';
import { useCart } from '../src/state/cart';

export default function Cart() {
  const router = useRouter();
  const { lines, add, remove, subtotal } = useCart();
  return (
    <Screen>
      <H1>{ka.cart.title}</H1>
      {lines.length === 0 && <Body muted>{ka.cart.empty}</Body>}
      {lines.map((l) => (
        <View key={l.productId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 18, padding: 12 }}>
          <Text style={{ flex: 1, fontFamily: fontFamily.extrabold, color: colors.ink }}>{l.name}</Text>
          <Button variant="outline" title="−" onPress={() => remove(l.productId)} />
          <Text style={{ fontFamily: fontFamily.extrabold, minWidth: 20, textAlign: 'center' }}>{l.quantity}</Text>
          <Button variant="outline" title="+" onPress={() => add({ productId: l.productId, name: l.name, unitPriceTetri: l.unitPriceTetri })} />
        </View>
      ))}
      <Body>{ka.cart.subtotal}: {formatGel(subtotal)}</Body>
      <Body muted>{ka.branch.hint}</Body>
      <Button title={ka.cart.checkout} disabled={lines.length === 0} onPress={() => router.push('/checkout')} />
    </Screen>
  );
}
