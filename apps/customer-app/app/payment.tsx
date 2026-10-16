import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Button, ErrorText, Header, Screen } from '../src/components/ui';
import { Icon } from '../src/components/Icon';
import { PayOverlay, type PayPhase } from '../src/components/PayOverlay';
import { supabase } from '../src/lib/supabase';
import { useDemoMode } from '../src/lib/demo';

interface Info { total_tetri: number; number: string; count: number }

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
    supabase.from('orders').select('total_tetri,number,order_items(quantity)').eq('id', id).single().then(({ data }) => {
      if (!data) return;
      const d = data as unknown as { total_tetri: number; number: string; order_items: { quantity: number }[] };
      setInfo({ total_tetri: d.total_tetri, number: d.number, count: (d.order_items ?? []).reduce((n, i) => n + i.quantity, 0) });
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
  return (
    <Screen scroll>
      <Header title={ka.payment.title} />
      <View style={{ padding: 20, gap: 14 }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 46, height: 36, borderRadius: 9, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' }}><Icon name="card" size={22} color={colors.yellow} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.checkout.card}</Text>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{ka.payment.note}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.muted }}>{ka.payment.order}</Text><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>№{info.number}</Text></View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{ka.payment.toPay}</Text><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 19, color: theme.text }}>{amount}</Text>
          </View>
        </View>
        {error && <ErrorText>{error}</ErrorText>}
        <Button title={`${ka.payment.payBtn} · ${amount}`} onPress={pay} disabled={!enabled || phase === 'processing'} />
        <Button variant="outline" title={ka.payment.cancelBack} onPress={() => router.replace('/menu')} />
        {!enabled && <ErrorText>{ka.payment.demoOff}</ErrorText>}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="lock" size={14} color={theme.muted} /><Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{ka.payment.note}</Text></View>
      </View>
      {phase ? <PayOverlay phase={phase} amount={amount} number={info.number} count={info.count} onTrack={() => router.replace({ pathname: '/order/[id]', params: { id: String(id) } })} onRetry={() => setPhase(null)} onMenu={() => router.replace('/menu')} /> : null}
    </Screen>
  );
}
