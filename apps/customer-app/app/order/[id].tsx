import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatGel, type OrderStatus } from '@gochits/shared';
import { colors, fontFamily } from '@gochits/ui-tokens';
import { Body, Button, Card, FadeIn, Header, Screen } from '../../src/components/ui';
import { supabase } from '../../src/lib/supabase';

// Status labels are placeholders until the restaurant confirms wording (ARCHITECTURE section 5).
const LABEL: Record<OrderStatus, string> = {
  pending_payment: 'გადახდის მოლოდინში', payment_failed: 'გადახდა ვერ შესრულდა', placed: 'შეკვეთა გაიგზავნა', accepted: 'მიღებულია',
  preparing: 'მზადდება', ready_for_pickup: 'მზადაა', out_for_delivery: 'გზაშია', delivered: 'მიტანილია', cancelled: 'გაუქმებულია', rejected: 'უარყოფილია',
};
const STEPS: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'];

interface Row { number: string; status: OrderStatus; total_tetri: number }

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => supabase.from('orders').select('number,status,total_tetri').eq('id', id).single().then(({ data }) => alive && data && setRow(data as Row));
    load();
    // Realtime: RLS limits this to the customer's own order.
    const ch = supabase.channel(`order:${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, load).subscribe();
    return () => { alive = false; supabase.removeChannel(ch); };
  }, [id]);

  if (!row) return <Screen><ActivityIndicator color={colors.ink} /></Screen>;
  const at = STEPS.indexOf(row.status);
  return (
    <Screen scroll>
      <Header title={row.number} subtitle={LABEL[row.status]} />
      <View style={{ padding: 20, gap: 12 }}>
        <Card>
          {STEPS.map((st, i) => {
            const done = at >= i;
            return (
              <FadeIn key={st} index={i}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 }}>
                  <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: done ? colors.red : colors.sand, alignItems: 'center', justifyContent: 'center' }}>
                    {done && <Text style={{ color: colors.white, fontSize: 12, fontFamily: fontFamily.extrabold }}>✓</Text>}
                  </View>
                  <Text style={{ fontFamily: done ? fontFamily.extrabold : fontFamily.regular, fontSize: 15, color: done ? colors.ink : colors.muted }}>{LABEL[st]}</Text>
                </View>
              </FadeIn>
            );
          })}
        </Card>
        <Body muted>{formatGel(row.total_tetri)}</Body>
        <Button title="მენიუ" onPress={() => router.replace('/menu')} variant="ink" />
      </View>
    </Screen>
  );
}
