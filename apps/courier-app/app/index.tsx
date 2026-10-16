import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, theme } from '@gochits/ui-tokens';
import { supabase } from '../src/supabase';
import { Btn, Card, Icon, T, gel } from '../src/ui';
import { RouteMap } from '../src/RouteMap';
import { pointUrl, routeUrl } from '../src/mapHtml';

interface Snap { street?: string; entrance?: string | null; floor?: string | null; apartment?: string | null; comment?: string | null }
interface Job {
  id: string; number: string; status: string; mine: boolean; branch_name: string; branch_address: string | null;
  branch_lat: number | null; branch_lng: number | null; dest_lat: number; dest_lng: number;
  address_snapshot: Snap; phone: string | null; full_name: string | null; total_tetri: number; delivery_fee_tetri: number;
  payment_method: 'card' | 'cash'; payment_status: string; distance_m: number | null;
}
interface Done { id: string; number: string; total_tetri: number; payment_method: 'card' | 'cash'; updated_at: string }

const dayStart = () => new Date(`${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tbilisi' })}T00:00:00+04:00`).toISOString();
const km = (m: number | null) => (m == null ? null : m < 1000 ? `${m} მ` : `${(m / 1000).toFixed(1)} კმ`);
const cooking = (s: string) => ['placed', 'accepted', 'preparing'].includes(s);
const buzz = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
const msg = (e: string) => /already_taken/.test(e) ? 'ეს შეკვეთა უკვე სხვა კურიერმა აიღო' : /not_available/.test(e) ? 'შეკვეთა აღარ არის ხელმისაწვდომი' : /too_late/.test(e) ? 'უკვე გზაშია, ვეღარ დააბრუნებ' : /forbidden/.test(e) ? 'ამ ანგარიშს კურიერის უფლება არ აქვს' : e;

function Status({ job }: { job: Job }) {
  const s = job.status;
  const [bg, fg, text] = s === 'out_for_delivery' ? ['#173D2A', '#7be0a5', 'გზაშია, მიიტანე მომხმარებელთან'] : s === 'ready_for_pickup' ? ['#2E9E5B', '#fff', 'მზადაა! აიღე შეკვეთა რესტორანში'] : s === 'cancelled' || s === 'rejected' ? [colors.red, '#fff', 'შეკვეთა გაუქმდა'] : [theme.surface2, theme.text, 'რესტორანი ამზადებს, მოემზადე'];
  return <View style={{ borderRadius: 14, padding: 12, backgroundColor: bg }}><T size={15} weight="extrabold" color={fg}>{text}</T></View>;
}

function Pay({ job }: { job: Job }) {
  const cash = job.payment_method === 'cash';
  return (
    <View style={{ borderRadius: 14, padding: 12, backgroundColor: cash ? colors.yellow : '#173D2A', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <T size={15} weight="extrabold" color={cash ? colors.ink : '#7be0a5'}>{cash ? 'აიღე ნაღდი ფული' : 'გადახდილია ბარათით'}</T>
      {cash ? <T size={22} weight="extrabold" color={colors.ink}>{gel(job.total_tetri)}</T> : null}
    </View>
  );
}

const pts = (j: Job) => (j.branch_lat != null && j.branch_lng != null ? { a: { lat: j.branch_lat, lng: j.branch_lng }, b: { lat: j.dest_lat, lng: j.dest_lng } } : null);

function MapBlock({ j, open, onToggle }: { j: Job; open: boolean; onToggle: (id: string) => void }) {
  const p = pts(j);
  return (
    <View style={{ gap: 10 }}>
      {p && open ? <RouteMap a={p.a} b={p.b} labelA={`A · ${j.branch_name}`} labelB="B · მომხმარებელი" /> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn title={open ? 'რუკის დამალვა' : 'რუკა'} icon="map" kind="ghost" onPress={() => onToggle(j.id)} style={{ flex: 1 }} disabled={!p} />
        <Btn title="მარშრუტი" icon="map" kind="ghost" onPress={() => Linking.openURL(p ? routeUrl(p.a, p.b) : pointUrl({ lat: j.dest_lat, lng: j.dest_lng }))} style={{ flex: 1 }} />
      </View>
      {!p ? <T size={12} color={theme.muted}>ფილიალის კოორდინატი არ არის მითითებული ადმინ პანელში, ამიტომ რუკაზე A წერტილი არ ჩანს.</T> : null}
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'offers' | 'mine' | 'done'>('offers');
  const [feed, setFeed] = useState<Job[]>([]);
  const [done, setDone] = useState<Done[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const known = useRef<Map<string, string> | null>(null);

  const load = useCallback(async () => {
    const r = await supabase.rpc('courier_feed');
    if (r.error) { setError(msg(r.error.message).includes('უფლება') ? msg(r.error.message) : 'ვერ ჩაიტვირთა. შეამოწმე ინტერნეტი.'); return; }
    const list = (r.data ?? []) as Job[];
    setError('');
    setFeed(list);
    const prev = known.current;
    const next = new Map(list.map((j) => [j.id + (j.mine ? 'm' : 'o'), j.status]));
    if (prev) {
      const newOffer = list.some((j) => !j.mine && !prev.has(j.id + 'o'));
      const nowReady = list.some((j) => j.mine && j.status === 'ready_for_pickup' && prev.get(j.id + 'm') !== 'ready_for_pickup');
      if (newOffer || nowReady) buzz();
    }
    known.current = next;
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const d = await supabase.from('orders').select('id,number,total_tetri,payment_method,updated_at').eq('courier_id', u.user.id).eq('status', 'delivered').gte('updated_at', dayStart()).order('updated_at', { ascending: false });
      setDone((d.data ?? []) as Done[]);
    }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  async function act(id: string, fn: string, after?: () => void) {
    setBusyId(id);
    const r = await supabase.rpc(fn, { p_order_id: id });
    setBusyId(null); setConfirm(null);
    if (r.error) setError(msg(r.error.message)); else { setError(''); after?.(); buzz(); }
    await load();
  }

  const offers = feed.filter((j) => !j.mine);
  const mine = feed.filter((j) => j.mine);
  const cashDone = done.filter((d) => d.payment_method === 'cash').reduce((s, d) => s + d.total_tetri, 0);
  const toggleMap = (id: string) => setMapOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ backgroundColor: colors.yellow, paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Image source={require('../assets/logo.png')} style={{ width: 96, height: 48 }} resizeMode="contain" />
        <Pressable accessibilityRole="button" accessibilityLabel="გასვლა" onPress={() => supabase.auth.signOut()} style={{ padding: 10 }}><Icon name="out" color={colors.ink} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, padding: 14 }}>
        {([['offers', `ახალი · ${offers.length}`], ['mine', `ჩემი · ${mine.length}`], ['done', `დღეს · ${done.length}`]] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === k ? colors.yellow : theme.surface, borderWidth: 1, borderColor: tab === k ? colors.yellow : theme.border }}>
            <T size={14} weight="extrabold" color={tab === k ? colors.ink : theme.text}>{label}</T>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 0, paddingBottom: insets.bottom + 24, gap: 14 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.yellow} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {error ? <Card style={{ borderColor: colors.red }}><T color="#ff8a80">{error}</T></Card> : null}

        {tab === 'offers' && (
          <>
            {offers.map((j) => (
              <Card key={j.id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <T size={20} weight="extrabold">№{j.number}</T>
                  <T size={13} color={cooking(j.status) ? theme.muted : '#7be0a5'}>{cooking(j.status) ? 'მზადდება' : 'მზადაა'}</T>
                </View>
                <View style={{ gap: 4 }}>
                  <T size={13} color={theme.muted}>A · აიღე: {j.branch_name}{j.branch_address ? `, ${j.branch_address}` : ''}</T>
                  <T size={13} color={theme.muted}>B · მიიტანე:</T>
                  <T size={18} weight="extrabold">{j.address_snapshot?.street ?? '—'}</T>
                  {km(j.distance_m) ? <T size={14} color={colors.yellow}>მანძილი: {km(j.distance_m)}</T> : null}
                </View>
                <Pay job={j} />
                <MapBlock j={j} open={mapOpen.has(j.id)} onToggle={toggleMap} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Btn title="გამოტოვება" kind="ghost" busy={busyId === j.id + 'd'} onPress={() => act(j.id, 'courier_decline')} style={{ flex: 1 }} />
                  <Btn title="აღება" icon="check" busy={busyId === j.id} onPress={() => act(j.id, 'courier_accept', () => setTab('mine'))} style={{ flex: 2 }} />
                </View>
              </Card>
            ))}
            {offers.length === 0 && !error ? (
              <View style={{ alignItems: 'center', gap: 10, paddingTop: 60 }}>
                <Icon name="box" size={44} color={theme.muted} />
                <T size={16} weight="semibold" color={theme.muted}>ახალი შეკვეთა ჯერ არ არის</T>
                <T size={13} color={theme.muted}>როცა შეკვეთა შემოვა, აქ თავისით გამოჩნდება</T>
              </View>
            ) : null}
          </>
        )}

        {tab === 'mine' && (
          <>
            {mine.map((j) => {
              const a = j.address_snapshot ?? {};
              const detail = [a.entrance && `სადარბაზო ${a.entrance}`, a.floor && `სართული ${a.floor}`, a.apartment && `ბინა ${a.apartment}`].filter(Boolean).join(' · ');
              const dead = j.status === 'cancelled' || j.status === 'rejected';
              return (
                <Card key={j.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <T size={20} weight="extrabold">№{j.number}</T>
                    <T size={13} color={theme.muted}>{km(j.distance_m) ?? ''}</T>
                  </View>
                  <Status job={j} />
                  {!dead && (
                    <>
                      <View style={{ gap: 4 }}>
                        <T size={13} color={theme.muted}>A · აიღე: {j.branch_name}{j.branch_address ? `, ${j.branch_address}` : ''}</T>
                        <T size={13} color={theme.muted}>B · მიიტანე:</T>
                        <T size={19} weight="extrabold">{a.street ?? '—'}</T>
                        {detail ? <T size={15} color={theme.muted}>{detail}</T> : null}
                        {a.comment ? <T size={14} color={colors.yellow}>💬 {a.comment}</T> : null}
                      </View>
                      <Pay job={j} />
                      <MapBlock j={j} open={!mapOpen.has(j.id)} onToggle={toggleMap} />
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <Btn title="მომხმარებელი" icon="phone" kind="ghost" disabled={!j.phone} onPress={() => j.phone && Linking.openURL(`tel:${j.phone}`)} style={{ flex: 1 }} />
                      </View>
                      {j.full_name ? <T size={13} color={theme.muted}>{j.full_name}{j.phone ? ` · ${j.phone}` : ''}</T> : null}
                      {j.status === 'out_for_delivery' ? (
                        confirm === j.id ? (
                          <View style={{ gap: 8 }}>
                            <T size={15} weight="semibold" style={{ textAlign: 'center' }}>დარწმუნებული ხარ, რომ მიტანილია?</T>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                              <Btn title="არა" kind="ghost" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
                              <Btn title="დიახ, მიტანილია" kind="green" icon="check" busy={busyId === j.id} onPress={() => act(j.id, 'courier_mark_delivered')} style={{ flex: 2 }} />
                            </View>
                          </View>
                        ) : <Btn title="მიტანილია" icon="check" onPress={() => setConfirm(j.id)} />
                      ) : (
                        confirm === j.id + 'r' ? (
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Btn title="არა" kind="ghost" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
                            <Btn title="დიახ, უარი" busy={busyId === j.id} onPress={() => act(j.id, 'courier_release')} style={{ flex: 2 }} />
                          </View>
                        ) : <Btn title="უარი ამ შეკვეთაზე" kind="ghost" onPress={() => setConfirm(j.id + 'r')} />
                      )}
                    </>
                  )}
                </Card>
              );
            })}
            {mine.length === 0 && !error ? <T color={theme.muted} style={{ textAlign: 'center', paddingTop: 40 }}>აღებული შეკვეთა არ გაქვს. „ახალი“-დან აიღე.</T> : null}
          </>
        )}

        {tab === 'done' && (
          <>
            <Card><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T color={theme.muted}>დღეს მიტანილი</T><T weight="extrabold">{done.length}</T></View><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T color={theme.muted}>აღებული ნაღდი ფული</T><T weight="extrabold" color={colors.yellow}>{gel(cashDone)}</T></View></Card>
            {done.map((d) => (
              <Card key={d.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View><T weight="extrabold">№{d.number}</T><T size={13} color={theme.muted}>{new Date(d.updated_at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tbilisi' })} · {d.payment_method === 'cash' ? 'ნაღდი' : 'ბარათი'}</T></View>
                <T weight="extrabold">{gel(d.total_tetri)}</T>
              </Card>
            ))}
            {done.length === 0 ? <T color={theme.muted} style={{ textAlign: 'center', paddingTop: 30 }}>დღეს ჯერ არაფერი მიგიტანია</T> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}
