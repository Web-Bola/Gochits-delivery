import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel, TERMINAL_STATUSES, type OrderStatus } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, ErrorText, FadeIn, Header } from '../src/components/ui';
import { TabBar } from '../src/components/TabBar';
import { Float } from '../src/components/fx';
import { supabase } from '../src/lib/supabase';
import { STATUS_LABEL } from '../src/lib/status';
import { useReorder } from '../src/lib/reorder';

interface Row { id: string; number: string; status: OrderStatus; total_tetri: number; created_at: string; branches: { name: string } | null; order_items: { name_snapshot: string; quantity: number }[] }

const dateText = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const active = (s: OrderStatus) => !TERMINAL_STATUSES.includes(s);

export default function Orders() {
  const router = useRouter();
  const reorder = useReorder();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(() => supabase.from('orders').select('id,number,status,total_tetri,created_at,branches(name),order_items(name_snapshot,quantity)').order('created_at', { ascending: false }).limit(50)
    .then(({ data, error }) => { if (error) { setFailed(true); setRows((r) => r ?? []); } else { setFailed(false); setRows((data ?? []) as unknown as Row[]); } }), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]);

  async function again(id: string) {
    setBusyId(id); setMsg(null);
    try {
      const r = await reorder(id);
      if (r.skipped.length > 0) setMsg(`${ka.orders.unavailableItems}: ${r.skipped.join(', ')}`);
      if (r.added > 0) router.push('/cart');
    } catch { setMsg(ka.errors.generic); } finally { setBusyId(null); }
  }

  const current = (rows ?? []).filter((r) => active(r.status));
  const past = (rows ?? []).filter((r) => !active(r.status));
  const card = (r: Row, i: number) => (
    <FadeIn key={r.id} index={i}>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: r.status === 'pending_payment' ? '/payment' : '/order/[id]', params: { id: r.id } })}>
        <Card selected={active(r.status)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text }}>{r.number}</Text>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: active(r.status) ? colors.ink : colors.white, backgroundColor: active(r.status) ? colors.yellow : r.status === 'delivered' ? '#2E7D4F' : theme.surface2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' }}>{STATUS_LABEL[r.status]}</Text>
          </View>
          {r.order_items.length > 0 ? <Text numberOfLines={2} style={{ fontFamily: fontFamily.regular, fontSize: 13, color: theme.muted }}>{r.order_items.map((it) => `${it.quantity}× ${it.name_snapshot}`).join(', ')}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Body muted>{dateText(r.created_at)}{r.branches ? ` · ${r.branches.name}` : ''}</Body>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.yellow }}>{formatGel(r.total_tetri)}</Text>
          </View>
          {active(r.status) ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.yellow }}>{ka.orders.track} →</Text> : (
            <Pressable accessibilityRole="button" disabled={busyId === r.id} onPress={() => again(r.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.yellow }}>{busyId === r.id ? '...' : `↻ ${ka.orders.reorder}`}</Text>
            </Pressable>
          )}
        </Card>
      </Pressable>
    </FadeIn>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={ka.orders.title} />
      {!rows ? <ActivityIndicator color={colors.yellow} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 110 }}>
          {failed && <Body>{ka.errors.network}</Body>}
          {msg && <ErrorText>{msg}</ErrorText>}
          {rows.length === 0 && !failed && (
            <View style={{ alignItems: 'center', gap: 12, paddingTop: 50 }}>
              <Float amplitude={8}><Text style={{ fontSize: 64 }}>🍔</Text></Float>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: theme.text }}>{ka.orders.empty}</Text>
              <Body muted>{ka.orders.emptyHint}</Body>
              <Button title={ka.orders.toMenu} onPress={() => router.replace('/menu')} variant="ink" />
            </View>
          )}
          {current.length > 0 && <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{ka.orders.active}</Text>}
          {current.map(card)}
          {past.length > 0 && <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text, marginTop: 6 }}>{ka.orders.past}</Text>}
          {past.map((r, i) => card(r, i + current.length))}
        </ScrollView>
      )}
      <TabBar />
    </View>
  );
}
