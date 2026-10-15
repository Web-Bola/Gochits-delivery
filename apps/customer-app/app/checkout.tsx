import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, ErrorText, Field, Header, Screen } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

// Card payment is NOT wired yet (provider undecided, see ARCHITECTURE D-PAY). Only cash orders are possible, and only
// if the branch has cod_enabled; the server rejects the order otherwise.
export default function Checkout() {
  const router = useRouter();
  const { lines, address, branch, subtotal, clear } = useCart();
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function place() {
    if (!branch || !address) return;
    setBusy(true); setError(null);
    const { data, error: e } = await supabase.rpc('create_order', {
      p_branch_id: branch.branch_id,
      p_address_id: address.id,
      p_items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
      p_payment_method: 'cash',
      p_notes: notes || null,
    });
    setBusy(false);
    if (e) { console.warn('create_order failed', e); setError(errorText(e.message)); return; }
    clear();
    router.replace({ pathname: '/order/[id]', params: { id: String(data) } });
  }

  const row = (k: string, v: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Body muted>{k}</Body><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );

  return (
    <Screen scroll>
      <Header back title={ka.checkout.title} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Card>
          {row(ka.branch.title, branch?.branch_name ?? '')}
          {row(ka.address.title, address?.street ?? '')}
          {row(ka.cart.subtotal, formatGel(subtotal))}
          <Body muted>{ka.branch.hint}</Body>
        </Card>
        <Field label={ka.checkout.notes} value={notes} onChangeText={setNotes} multiline />
        {error && <ErrorText>{error}</ErrorText>}
        <Button title={busy ? '...' : ka.checkout.place} onPress={place} disabled={busy || lines.length === 0} />
      </ScrollView>
    </Screen>
  );
}
