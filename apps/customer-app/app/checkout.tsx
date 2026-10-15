import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, ErrorText, Field, Header, Screen } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useDemoMode } from '../src/lib/demo';
import { useCart } from '../src/state/cart';

type Method = 'card' | 'cash';

// Card payment is a DEMO simulation (no card data, server flag app_settings.demo_mode). Real provider is undecided (D-PAY).
// Cash only if the branch has cod_enabled; the server enforces it.
export default function Checkout() {
  const router = useRouter();
  const demo = useDemoMode();
  const { lines, address, branch, subtotal, clear } = useCart();
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<Method>('card');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cashOk = !!branch?.cod_enabled;
  const cardOk = demo === true;
  const chosen: Method | null = method === 'card' ? (cardOk ? 'card' : cashOk ? 'cash' : null) : (cashOk ? 'cash' : cardOk ? 'card' : null);
  // Estimate only, the server computes the real fee.
  const fee = branch?.fee_tetri == null ? null : branch.free_from_tetri != null && subtotal >= branch.free_from_tetri ? 0 : branch.fee_tetri;

  async function place() {
    if (!branch || !address || !chosen) return;
    setBusy(true); setError(null);
    const { data, error: e } = await supabase.rpc('create_order', {
      p_branch_id: branch.branch_id,
      p_address_id: address.id,
      p_items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
      p_payment_method: chosen,
      p_notes: notes || null,
    });
    setBusy(false);
    if (e) { console.warn('create_order failed', e); setError(errorText(e.message)); return; }
    clear();
    if (chosen === 'card') router.replace({ pathname: '/payment', params: { id: String(data) } });
    else router.replace({ pathname: '/order/[id]', params: { id: String(data) } });
  }

  const row = (k: string, v: string, big?: boolean) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Body muted>{k}</Body><Text style={{ fontFamily: fontFamily.extrabold, fontSize: big ? 18 : 14, color: big ? colors.yellow : theme.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );

  const option = (m: Method, icon: string, title: string, enabled: boolean, hint?: string) => {
    const on = chosen === m;
    return (
      <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !enabled }} disabled={!enabled} onPress={() => setMethod(m)}>
        <Card selected={on} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: enabled ? 1 : 0.45 }}>
          <Text style={{ fontSize: 26 }}>{icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{title}</Text>
            {hint ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{hint}</Text> : null}
          </View>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? colors.yellow : theme.border, alignItems: 'center', justifyContent: 'center' }}>
            {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.yellow }} />}
          </View>
        </Card>
      </Pressable>
    );
  };

  return (
    <Screen scroll>
      <Header back title={ka.checkout.title} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Card>
          {row(ka.branch.title, branch?.branch_name ?? '')}
          {row(ka.address.title, address?.street ?? '')}
        </Card>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text }}>{ka.checkout.payment}</Text>
        {option('card', '💳', ka.checkout.card, cardOk, cardOk ? ka.payment.note : ka.payment.demoOff)}
        {option('cash', '💵', ka.checkout.cash, cashOk, cashOk ? undefined : ka.checkout.cashOff)}
        <Field label={ka.checkout.notes} value={notes} onChangeText={setNotes} multiline />
        <Card>
          {row(ka.cart.subtotal, formatGel(subtotal))}
          {row(ka.checkout.delivery, fee === null ? '—' : fee === 0 ? '0.00 ₾' : formatGel(fee))}
          {row(ka.checkout.total, fee === null ? formatGel(subtotal) : formatGel(subtotal + fee), true)}
          <Body muted>{ka.checkout.deliveryServer}</Body>
        </Card>
        {error && <ErrorText>{error}</ErrorText>}
        <Button title={busy ? '...' : chosen === 'card' ? ka.checkout.pay : ka.checkout.place} onPress={place} disabled={busy || lines.length === 0 || !chosen} />
      </ScrollView>
    </Screen>
  );
}
