import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel, type OrderStatus } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, FadeIn, Header, Screen } from '../src/components/ui';
import { TabBar } from '../src/components/TabBar';
import { Float } from '../src/components/fx';
import { supabase } from '../src/lib/supabase';
import { STATUS_LABEL } from '../src/lib/status';

interface Row { id: string; number: string; status: OrderStatus; total_tetri: number; created_at: string }

const dateText = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const active = (s: OrderStatus) => !['delivered', 'cancelled', 'rejected', 'payment_failed'].includes(s);

export default function Orders() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => supabase.from('orders').select('id,number,status,total_tetri,created_at').order('created_at', { ascending: false }).limit(50)
    .then(({ data, error }) => { if (error) { setFailed(true); setRows([]); } else { setFailed(false); setRows((data ?? []) as Row[]); } }), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={ka.orders.title} />
      {!rows ? <ActivityIndicator color={colors.yellow} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 110 }}>
          {failed && <Body>{ka.errors.generic}</Body>}
          {rows.length === 0 && !failed && (
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 50 }}>
              <Float amplitude={8}><Text style={{ fontSize: 64 }}>🍔</Text></Float>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: theme.text }}>{ka.orders.empty}</Text>
              <Body muted>{ka.orders.emptyHint}</Body>
              <Button title={ka.orders.toMenu} onPress={() => router.replace('/menu')} variant="ink" />
            </View>
          )}
          {rows.map((r, i) => (
            <FadeIn key={r.id} index={i}>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: r.status === 'pending_payment' ? '/payment' : '/order/[id]', params: { id: r.id } })}>
                <Card selected={active(r.status)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text }}>{r.number}</Text>
                    <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: active(r.status) ? colors.ink : colors.white, backgroundColor: active(r.status) ? colors.yellow : r.status === 'delivered' ? '#2E7D4F' : theme.surface2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' }}>{STATUS_LABEL[r.status]}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Body muted>{dateText(r.created_at)}</Body>
                    <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.yellow }}>{formatGel(r.total_tetri)}</Text>
                  </View>
                  {active(r.status) && <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.yellow }}>{ka.orders.track} →</Text>}
                </Card>
              </Pressable>
            </FadeIn>
          ))}
        </ScrollView>
      )}
      <TabBar />
    </View>
  );
}
