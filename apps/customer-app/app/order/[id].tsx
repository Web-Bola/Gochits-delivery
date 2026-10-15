import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatGel, type OrderStatus } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, FadeIn, Screen } from '../../src/components/ui';
import { BackButton } from '../../src/components/ui';
import { Confetti } from '../../src/components/fx';
import { TrackMap } from '../../src/components/TrackMap';
import { supabase } from '../../src/lib/supabase';
import { useDemoMode } from '../../src/lib/demo';
import { STATUS_LABEL } from '../../src/lib/status';

const STEPS: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'];
// Five steps as in the tracking design; "preparing" and "ready" share one line.
const LINES = ['შეკვეთა მიღებულია', 'რესტორანმა დაადასტურა', 'მზადდება', 'კურიერი გზაშია', 'მიტანილია'];
const LINE_OF: Partial<Record<OrderStatus, number>> = { placed: 0, accepted: 1, preparing: 2, ready_for_pickup: 2, out_for_delivery: 3, delivered: 4 };
const INK = colors.ink;

interface Row { number: string; status: OrderStatus; total_tetri: number; payment_method: 'card' | 'cash'; order_items: { name_snapshot: string; quantity: number }[] }

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const demo = useDemoMode();
  const [row, setRow] = useState<Row | null>(null);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => supabase.from('orders').select('number,status,total_tetri,payment_method,order_items(name_snapshot,quantity)').eq('id', id).single()
    .then(({ data }) => data && setRow(data as unknown as Row)), [id]);

  useEffect(() => {
    load();
    // Realtime + 4 s polling fallback. RLS limits both to the customer's own order.
    const ch = supabase.channel(`order:${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => { load(); }).subscribe();
    const poll = setInterval(load, 4000);
    return () => { clearInterval(poll); supabase.removeChannel(ch); };
  }, [id, load]);

  const at = row ? STEPS.indexOf(row.status) : -1;
  const advance = useCallback(async () => {
    setBusy(true);
    await supabase.rpc('demo_advance_order', { p_order_id: id });
    await load();
    setBusy(false);
  }, [id, load]);

  const finished = !!row && !STEPS.slice(0, -1).includes(row.status);
  useEffect(() => {
    if (!auto || finished) return;
    const t = setTimeout(advance, 4500);
    return () => clearTimeout(t);
  }, [auto, finished, advance, row?.status]);

  if (!row) return <Screen><ActivityIndicator color={colors.yellow} /></Screen>;
  const cur = LINE_OF[row.status];
  const phase = row.status === 'delivered' ? 2 : row.status === 'out_for_delivery' ? 1 : 0;
  return (
    <View style={{ flex: 1, backgroundColor: '#FFF1BF' }}>
      <TrackMap phase={phase} />
      <View style={{ position: 'absolute', left: 18, top: 22 }}>
        <BackButton onPress={() => router.replace('/orders')} />
      </View>
      <View style={{ flex: 1, marginTop: -28, backgroundColor: colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: INK, shadowOpacity: 0.16, shadowRadius: 30, shadowOffset: { width: 0, height: -12 } }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16 }} showsVerticalScrollIndicator={false}>
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#E8DDB8', alignSelf: 'center' }} />
          <View>
            <Text style={{ fontSize: 13, color: '#6b5a52', fontFamily: fontFamily.semibold }}>შეკვეთა №{row.number}</Text>
            <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 22, color: row.status === 'payment_failed' || row.status === 'cancelled' || row.status === 'rejected' ? colors.red : INK }}>{STATUS_LABEL[row.status]}</Text>
          </View>
          {cur !== undefined && (
            <View>
              {LINES.map((label, i) => {
                const done = i < cur || row.status === 'delivered';
                const active = i === cur && row.status !== 'delivered';
                return (
                  <FadeIn key={label} index={i}>
                    <View style={{ flexDirection: 'row', gap: 14, minHeight: 42 }}>
                      <View style={{ alignItems: 'center', width: 26 }}>
                        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? INK : active ? colors.red : colors.white, borderWidth: done ? 0 : active ? 4 : 3, borderColor: active ? colors.yellow : '#E8DDB8' }}>
                          {done && <Text style={{ color: colors.yellow, fontSize: 13, fontFamily: fontFamily.extrabold }}>✓</Text>}
                        </View>
                        {i < LINES.length - 1 && <View style={{ flex: 1, width: 4, borderRadius: 2, marginVertical: 2, backgroundColor: done ? INK : '#E8DDB8' }} />}
                      </View>
                      <Text style={{ paddingTop: 2, fontSize: 15, fontFamily: active ? fontFamily.extrabold : done ? fontFamily.semibold : fontFamily.regular, color: active ? colors.red : done ? INK : '#8a7a70' }}>{label}</Text>
                    </View>
                  </FadeIn>
                );
              })}
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF8E1', borderRadius: 20, padding: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.white, fontFamily: fontFamily.extrabold }}>კ</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: INK }}>{ka.order.courier}</Text>
              <Text style={{ fontSize: 12, color: '#6b5a52', fontFamily: fontFamily.regular }}>{ka.order.courierHint}</Text>
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: INK }}>{ka.order.items}</Text>
            {(row.order_items ?? []).map((it, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: '#6b5a52' }}>{it.name_snapshot}</Text><Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: '#6b5a52' }}>× {it.quantity}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: '#6b5a52' }}>{ka.order.method}</Text>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: INK }}>{row.payment_method === 'card' ? ka.checkout.card : ka.checkout.cash}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: '#6b5a52' }}>{ka.order.total}</Text>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: colors.red }}>{formatGel(row.total_tetri)}</Text>
            </View>
          </View>
          {demo && !finished && (
            <View style={{ gap: 10, backgroundColor: INK, borderRadius: 20, padding: 14 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.yellow }}>🧪 {ka.order.demoBanner}</Text>
              <Button variant="ink" title={busy ? '...' : ka.order.demoNext} onPress={advance} disabled={busy} />
              <Button variant="outline" title={auto ? ka.order.demoStop : ka.order.demoAuto} onPress={() => setAuto((a) => !a)} />
            </View>
          )}
          <Button title={ka.order.back} onPress={() => router.replace('/menu')} variant="red" />
        </ScrollView>
      </View>
      {row.status === 'delivered' && <Confetti />}
    </View>
  );
}
