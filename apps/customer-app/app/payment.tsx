import { useEffect, useState } from 'react';
import { Icon } from '../src/components/Icon';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, ErrorText, FadeIn, Header, Screen } from '../src/components/ui';
import { Float, Pulse } from '../src/components/fx';
import { supabase } from '../src/lib/supabase';
import { useDemoMode } from '../src/lib/demo';

type Phase = 'ready' | 'processing' | 'failed';

/** DEMO payment. There are NO card inputs: nothing real is collected. The buttons only simulate the provider's answer. */
export default function Payment() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const demo = useDemoMode();
  const [total, setTotal] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('orders').select('total_tetri').eq('id', id).single().then(({ data }) => data && setTotal((data as { total_tetri: number }).total_tetri));
  }, [id]);

  async function pay(success: boolean) {
    setPhase('processing'); setError(null);
    await new Promise((r) => setTimeout(r, 1600));
    const { error: e } = await supabase.rpc('demo_pay_order', { p_order_id: id, p_success: success });
    if (e) { setError(errorText(e.message)); setPhase('ready'); return; }
    if (success) router.replace({ pathname: '/order/[id]', params: { id: String(id) } });
    else setPhase('failed');
  }

  if (total === null || demo === null) return <Screen><ActivityIndicator color={colors.yellow} /></Screen>;
  return (
    <Screen scroll>
      <Header title={ka.payment.title} />
      <View style={{ padding: 20, gap: 14 }}>
        <View style={{ backgroundColor: colors.yellow, borderRadius: 16, padding: 12 }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.ink, textAlign: 'center' }}>{ka.payment.banner}</Text>
        </View>
        <FadeIn>
          <Float amplitude={5}>
            <View style={{ height: 190, borderRadius: 22, padding: 20, justifyContent: 'space-between', backgroundColor: colors.red, overflow: 'hidden' }}>
              <View style={{ position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.12)', right: -60, top: -70 }} />
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: colors.white }}>Gochit's DEMO</Text>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 22, letterSpacing: 3, color: colors.white }}>•••• •••• •••• 0000</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: colors.white }}>NO REAL CARD</Text>
                <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: colors.white }}>MM/YY</Text>
              </View>
            </View>
          </Float>
        </FadeIn>
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Body muted>{ka.checkout.total}</Body>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: colors.yellow }}>{formatGel(total)}</Text>
          </View>
          <Body muted>{ka.payment.note}</Body>
        </Card>
        {phase === 'processing' && (
          <View style={{ alignItems: 'center', justifyContent: 'center', height: 90 }}>
            <Pulse size={70} color={colors.yellow} /><ActivityIndicator color={colors.yellow} size="large" />
          </View>
        )}
        {phase === 'failed' && (
          <Card style={{ borderColor: colors.red, alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={32} color={colors.white} strokeWidth={3} /></View>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{ka.payment.failedTitle}</Text>
          </Card>
        )}
        {error && <ErrorText>{error}</ErrorText>}
        {phase === 'ready' && (
          <>
            <Button title={ka.payment.success} onPress={() => pay(true)} disabled={!demo} />
            <Button variant="outline" title={ka.payment.fail} onPress={() => pay(false)} disabled={!demo} />
            {!demo && <ErrorText>{ka.payment.demoOff}</ErrorText>}
          </>
        )}
        {phase === 'failed' && <Button title={ka.orders.toMenu} onPress={() => router.replace('/menu')} />}
      </View>
    </Screen>
  );
}
