import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { Body, Button, Field, H1, Screen } from '../src/components/ui';
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
    if (e) { setError(errorText(e.message)); return; }
    clear();
    router.replace({ pathname: '/order/[id]', params: { id: String(data) } });
  }

  return (
    <Screen>
      <H1>{ka.checkout.title}</H1>
      <Body>{branch?.branch_name}</Body>
      <Body muted>{address?.street}</Body>
      <Body>{ka.cart.subtotal}: {formatGel(subtotal)}</Body>
      <Body muted>{ka.branch.hint}</Body>
      <Field label={ka.checkout.notes} value={notes} onChangeText={setNotes} multiline />
      {error && <Text accessibilityLiveRegion="polite" style={{ color: '#D8141C' }}>{error}</Text>}
      <Button title={ka.checkout.place} onPress={place} disabled={busy || lines.length === 0} />
    </Screen>
  );
}
