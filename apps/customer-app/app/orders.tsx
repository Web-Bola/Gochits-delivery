import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../src/components/Icon';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel, TERMINAL_STATUSES, type OrderStatus } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Card, ErrorText, FadeIn, Header, StateView } from '../src/components/ui';
import { TabBar } from '../src/components/TabBar';
import { Float } from '../src/components/fx';
import { supabase } from '../src/lib/supabase';
import { STATUS_LABEL } from '../src/lib/status';
import { useReorder } from '../src/lib/reorder';
import { loadMerchants } from '../src/lib/merchants';
import { merchantArt } from '../src/lib/art';

interface Row { id: string; number: string; status: OrderStatus; total_tetri: number; created_at: string; branches: { name: string; merchant_id: string | null } | null; order_items: { name_snapshot: string; quantity: number }[] }

const dateText = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const active = (s: OrderStatus) => !TERMINAL_STATUSES.includes(s);

export default function Orders() {
  const router = useRouter();
  const reorder = useReorder();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [slugs, setSlugs] = useState<Record<string, string>>({});
  const [mnames, setMnames] = useState<Record<string, string>>({});
  useEffect(() => { loadMerchants().then((l) => { setSlugs(Object.fromEntries(l.map((m) => [m.id, m.slug]))); setMnames(Object.fromEntries(l.map((m) => [m.id, m.name]))); }).catch(() => undefined); }, []);
  const [tab, setTab] = useState<'active' | 'past'>('active');

  const load = useCallback(() => supabase.from('orders').select('id,number,status,total_tetri,created_at,branches(name,merchant_id),order_items(name_snapshot,quantity)').order('created_at', { ascending: false }).limit(50)
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
  const dayText = (iso: string) => {
    const d = new Date(iso); const now = new Date(); const p = (n: number) => String(n).padStart(2, '0');
    const t = `${p(d.getHours())}:${p(d.getMinutes())}`;
    if (d.toDateString() === now.toDateString()) return `დღეს, ${t}`;
    const y = new Date(now.getTime() - 86400000);
    if (d.toDateString() === y.toDateString()) return `გუშინ, ${t}`;
    return dateText(iso);
  };
  const card = (r: Row, i: number) => {
    const mid = r.branches?.merchant_id ?? null;
    const art = mid && slugs[mid] ? merchantArt(slugs[mid]!) : null;
    const act = active(r.status);
    const tone = act ? colors.brand : r.status === 'delivered' ? theme.muted : colors.red;
    const qty = r.order_items.reduce((n, it) => n + it.quantity, 0);
    return (
    <FadeIn key={r.id} index={i}>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: r.status === 'pending_payment' ? '/payment' : '/order/[id]', params: { id: r.id } })}>
        <View style={{ flexDirection: 'row', gap: 12, backgroundColor: theme.surface, borderRadius: 20, padding: 12, borderWidth: 1, borderColor: 'rgba(11,167,154,0.14)' }}>
          <View style={{ width: 72, height: 72, borderRadius: 14, overflow: 'hidden', backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' }}>
            {art ? <Image source={art.card} style={{ width: 72, height: 72 }} resizeMode="cover" /> : <Icon name="receipt" size={26} color={colors.brand} />}
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text }}>{(mid && mnames[mid]) || r.branches?.name || r.number}</Text>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 11.5, color: tone, backgroundColor: act ? 'rgba(11,167,154,0.14)' : 'rgba(173,191,204,0.14)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' }}>{STATUS_LABEL[r.status]}</Text>
            </View>
            <Text style={{ fontFamily: fontFamily.regular, fontSize: 12.5, color: theme.muted }}>{qty} პროდუქტი · №{r.number}</Text>
            <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{dayText(r.created_at)}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text }}>{formatGel(r.total_tetri)}</Text>
              {act ? (
                <View style={{ borderWidth: 1, borderColor: 'rgba(11,167,154,0.5)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12.5, color: colors.brand }}>თვალყური</Text></View>
              ) : (
                <Pressable accessibilityRole="button" disabled={busyId === r.id} onPress={() => again(r.id)} style={{ borderWidth: 1, borderColor: 'rgba(11,167,154,0.5)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 }}>
                  <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12.5, color: colors.brand }}>{busyId === r.id ? '...' : 'გამეორება'}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Pressable>
    </FadeIn>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={ka.orders.title} />
      {!rows ? <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} /> : (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 110 }}>
          {failed && <StateView tone="error" icon="clock" title={ka.errors.network} actionTitle={ka.common.retry} onAction={load} />}
          {msg && <ErrorText>{msg}</ErrorText>}
          {rows.length === 0 && !failed && <StateView icon="receipt" title={ka.orders.empty} hint={ka.orders.emptyHint} actionTitle={ka.orders.toMenu} onAction={() => router.replace('/home')} />}
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 24, padding: 4, borderWidth: 1, borderColor: 'rgba(11,167,154,0.14)' }}>
            {([['active', 'აქტიური'], ['past', 'ისტორია']] as const).map(([id, label]) => (
              <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)}
                style={{ flex: 1, minHeight: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === id ? colors.brand : 'transparent' }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: tab === id ? colors.onBrand : theme.muted }}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {(tab === 'active' ? current : past).map(card)}
          {rows.length > 0 && (tab === 'active' ? current : past).length === 0 ? <StateView icon="receipt" title={tab === 'active' ? 'აქტიური შეკვეთა არ გაქვს' : 'დასრულებული შეკვეთა ჯერ არ გაქვს'} /> : null}
        </ScrollView>
      )}
      <TabBar />
    </View>
  );
}
