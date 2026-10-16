import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Button, ErrorText, Screen } from '../src/components/ui';
import { Icon } from '../src/components/Icon';
import { PayOverlay, type PayPhase } from '../src/components/PayOverlay';
import { supabase } from '../src/lib/supabase';
import { useDemoMode } from '../src/lib/demo';

interface Item { name_snapshot: string; quantity: number; unit_price_tetri: number }
interface Info { total_tetri: number; subtotal_tetri: number; delivery_fee_tetri: number; discount_tetri: number; number: string; items: Item[] }

/**
 * Card step. No card data is collected here (the real provider's page will replace the button later).
 * Until a provider is connected the server only accepts the payment while app_settings.demo_mode is on; otherwise the button stays disabled.
 */
export default function Payment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const enabled = useDemoMode();
  const [info, setInfo] = useState<Info | null>(null);
  const [phase, setPhase] = useState<PayPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    supabase.from('orders').select('total_tetri,subtotal_tetri,delivery_fee_tetri,discount_tetri,number,order_items(name_snapshot,quantity,unit_price_tetri)').eq('id', id).single().then(({ data }) => {
      if (!data) return;
      const d = data as unknown as Omit<Info, 'items'> & { order_items: Item[] };
      setInfo({ total_tetri: d.total_tetri, subtotal_tetri: d.subtotal_tetri, delivery_fee_tetri: d.delivery_fee_tetri, discount_tetri: d.discount_tetri, number: d.number, items: d.order_items ?? [] });
    });
  }, [id]);

  async function pay() {
    if (busy.current) return;
    busy.current = true; setPhase('processing'); setError(null);
    await new Promise((r) => setTimeout(r, 1500));
    const { error: e } = await supabase.rpc('demo_pay_order', { p_order_id: id, p_success: true });
    busy.current = false;
    if (e) { setError(errorText(e.message)); setPhase('fail'); return; }
    setPhase('ok');
  }

  if (!info || enabled === null) return <Screen><ActivityIndicator color={colors.yellow} /></Screen>;
  const amount = formatGel(info.total_tetri);
  const count = info.items.reduce((n, i) => n + i.quantity, 0);
  const line = (k: string, v: string, accent?: boolean) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.muted }}>{k}</Text>
      <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: accent ? colors.yellow : theme.text }}>{v}</Text>
    </View>
  );

  return (
    <Screen scroll>
      <View style={{ backgroundColor: colors.yellow, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28, alignItems: 'center', gap: 6 }}>
        <Image source={require('../assets/logo.png')} style={{ width: 84, height: 54 }} resizeMode="contain" accessibilityLabel="Gochit's" />
        <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: colors.ink, opacity: 0.75, marginTop: 6 }}>{ka.payment.toPay}</Text>
        <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 40, color: colors.ink, lineHeight: 48 }}>{amount}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <View style={{ backgroundColor: colors.ink, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.yellow }}>№{info.number}</Text></View>
          <View style={{ backgroundColor: 'rgba(26,13,11,0.14)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5 }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.ink }}>{count} {ka.cart.items}</Text></View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 24 }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 8 }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text, marginBottom: 2 }}>{ka.checkout.yourOrder}</Text>
          {info.items.map((it, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Text numberOfLines={2} style={{ flex: 1, fontFamily: fontFamily.regular, fontSize: 14, color: theme.text }}>{it.quantity}× {it.name_snapshot}</Text>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: theme.text }}>{formatGel(it.unit_price_tetri * it.quantity)}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 4 }} />
          {line(ka.cart.subtotal, formatGel(info.subtotal_tetri))}
          {info.discount_tetri > 0 ? line(ka.cart.discount, `−${formatGel(info.discount_tetri)}`, true) : null}
          {line(ka.checkout.delivery, formatGel(info.delivery_fee_tetri))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: 18, padding: 14 }}>
          <View style={{ width: 46, height: 36, borderRadius: 9, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name="card" size={22} color={colors.yellow} /></View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.checkout.card}</Text>
            <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{ka.payment.note}</Text>
          </View>
          <Icon name="lock" size={18} color={theme.muted} />
        </View>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {!enabled ? <ErrorText>{ka.payment.demoOff}</ErrorText> : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 4, backgroundColor: theme.bg, borderTopWidth: 1, borderTopColor: theme.border }}>
        <Button title={`${ka.payment.payBtn} · ${amount}`} onPress={pay} disabled={!enabled || phase === 'processing'} />
        <Pressable accessibilityRole="button" onPress={() => router.replace('/menu')} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.muted }}>{ka.payment.cancelBack}</Text>
        </Pressable>
      </View>
      {phase ? <PayOverlay phase={phase} amount={amount} number={info.number} count={count} onTrack={() => router.replace({ pathname: '/order/[id]', params: { id: String(id) } })} onRetry={() => setPhase(null)} onMenu={() => router.replace('/menu')} /> : null}
    </Screen>
  );
}
