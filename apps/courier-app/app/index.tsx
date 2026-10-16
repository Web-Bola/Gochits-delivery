import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../src/supabase';
import { Btn, Card, Icon, T, c, gel } from '../src/ui';
import { FullMap } from '../src/FullMap';
import { Slide } from '../src/Slide';
import { embedUrl, pointUrl, routeUrl, type Pt } from '../src/mapHtml';

interface Snap { street?: string; entrance?: string | null; floor?: string | null; apartment?: string | null; comment?: string | null }
interface Job {
  id: string; number: string; status: string; mine: boolean; branch_name: string; branch_address: string | null;
  branch_lat: number | null; branch_lng: number | null; dest_lat: number; dest_lng: number;
  address_snapshot: Snap; phone: string | null; full_name: string | null; total_tetri: number; delivery_fee_tetri: number;
  payment_method: 'card' | 'cash'; payment_status: string; distance_m: number | null;
}
interface Done { id: string; number: string; total_tetri: number; delivery_fee_tetri: number; payment_method: 'card' | 'cash'; updated_at: string }

const dayStart = () => new Date(`${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tbilisi' })}T00:00:00+04:00`).toISOString();
const km = (m: number | null) => (m == null ? null : m < 1000 ? `${m} მ` : `${(m / 1000).toFixed(1)} კმ`);
const buzz = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
const msg = (e: string) => /already_taken/.test(e) ? 'ეს შეკვეთა უკვე სხვა კურიერმა აიღო' : /not_available/.test(e) ? 'შეკვეთა აღარ არის ხელმისაწვდომი' : /too_late/.test(e) ? 'უკვე გზაშია, ვეღარ დააბრუნებ' : /not_ready/.test(e) ? 'შეკვეთა ჯერ მზად არ არის' : /could not find the function|schema cache/.test(e) ? 'ბაზა ჯერ არ არის განახლებული (გაუშვი ახალი SQL მიგრაცია Supabase-ში)' : /forbidden/.test(e) ? 'ამ ანგარიშს კურიერის უფლება არ აქვს' : e;
const STEPS = [0, 1, 2, 3];
const stepOf = (s: string) => (s === 'out_for_delivery' ? 3 : s === 'ready_for_pickup' ? 2 : s === 'preparing' || s === 'accepted' ? 1 : 0);

const Row = ({ label, value, color = c.ink, strong }: { label: string; value: string; color?: string; strong?: boolean }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
    <T size={16} color={c.muted}>{label}</T><T size={strong ? 22 : 17} weight="extrabold" color={color}>{value}</T>
  </View>
);

const mapOf = (j: Job) => {
  const A: Pt | null = j.branch_lat != null && j.branch_lng != null ? { lat: j.branch_lat, lng: j.branch_lng } : null;
  return embedUrl(A, { lat: j.dest_lat, lng: j.dest_lng });
};
const MapBox = ({ url, h = 220 }: { url: string; h?: number }) => (
  <View style={{ height: h, borderRadius: 16, overflow: 'hidden', backgroundColor: c.soft }}><FullMap url={url} /></View>
);

/** Two stops: pick up, drop off. */
function Stops({ j, full }: { j: Job; full: boolean }) {
  const a = j.address_snapshot ?? {};
  const detail = full ? [a.entrance && `სადარბაზო ${a.entrance}`, a.floor && `სართული ${a.floor}`, a.apartment && `ბინა ${a.apartment}`].filter(Boolean).join(', ') : '';
  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 2 }}><T size={13} color={c.muted}>აიღე</T><T size={18} weight="extrabold">{j.branch_name}</T>{full && j.branch_address ? <T size={15} color={c.muted}>{j.branch_address}</T> : null}</View>
      <View style={{ gap: 2 }}>
        <T size={13} color={c.muted}>მიიტანე</T><T size={18} weight="extrabold">{a.street ?? '—'}</T>
        {detail ? <T size={15} color={c.muted}>{detail}</T> : null}
        {full && a.comment ? <T size={15} color={c.yellow}>კომენტარი: {a.comment}</T> : null}
      </View>
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
  const [mapOpen, setMapOpen] = useState<string | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
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
      const d = await supabase.from('orders').select('id,number,total_tetri,delivery_fee_tetri,payment_method,updated_at').eq('courier_id', u.user.id).eq('status', 'delivered').gte('updated_at', dayStart()).order('updated_at', { ascending: false });
      setDone((d.data ?? []) as Done[]);
    }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);

  async function act(id: string, fn: string, after?: () => void) {
    setBusyId(id);
    const r = await supabase.rpc(fn, { p_order_id: id });
    setBusyId(null); setConfirmRelease(null);
    if (r.error) setError(msg(r.error.message)); else { setError(''); after?.(); buzz(); }
    await load();
  }

  const offers = feed.filter((j) => !j.mine);
  const mine = feed.filter((j) => j.mine);
  const cashDone = done.filter((d) => d.payment_method === 'cash').reduce((s, d) => s + d.total_tetri, 0);
  const earned = done.reduce((s, d) => s + d.delivery_fee_tetri, 0);
  const current = mine.find((j) => j.id === sel) ?? mine[0];


  const tabs = [['offers', 'ახალი', offers.length], ['mine', 'ჩემი', mine.length], ['done', 'დღეს', done.length]] as const;
  const route = (j: Job) => (j.branch_lat != null && j.branch_lng != null ? routeUrl({ lat: j.branch_lat, lng: j.branch_lng }, { lat: j.dest_lat, lng: j.dest_lng }) : pointUrl({ lat: j.dest_lat, lng: j.dest_lng }));
  const pinned = tab === 'mine' && current && (current.status === 'ready_for_pickup' || current.status === 'out_for_delivery') ? current : null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 520 }}>
        {/* header */}
        <View style={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ gap: 2 }}>
            <T size={24} weight="extrabold">კურიერი</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: error ? c.red : c.green }} />
              <T size={14} color={c.muted}>{error ? 'კავშირი არ არის' : 'ონლაინ'}</T>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="გასვლა" onPress={() => supabase.auth.signOut({ scope: 'local' })} style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="out" color={c.ink} size={22} />
          </Pressable>
        </View>

        {/* tabs */}
        <View style={{ flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.line }}>
          {tabs.map(([k, label, n]) => (
            <Pressable key={k} accessibilityRole="tab" onPress={() => { setTab(k); setSel(null); setConfirmRelease(null); }} style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderBottomWidth: 3, borderBottomColor: tab === k ? c.yellow : 'transparent', marginBottom: -1 }}>
              <T size={17} weight="extrabold" color={tab === k ? c.ink : c.muted}>{label}</T>
              {n > 0 && k !== 'done' ? <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: c.yellow }}><T size={13} weight="extrabold" color={c.dark}>{String(n)}</T></View> : null}
            </Pressable>
          ))}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 30, gap: 14 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={c.yellow} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
          {error ? <View style={{ backgroundColor: c.redSoft, borderRadius: 14, padding: 14 }}><T size={15} color={c.red}>{error}</T></View> : null}

          {tab === 'offers' && (
            <>
              {offers.map((j) => {
                const cash = j.payment_method === 'cash';
                const showMap = mapOpen === j.id;
                return (
                  <Card key={j.id}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View>
                        <T size={13} color={c.muted}>შენი საფასური</T>
                        <T size={34} weight="extrabold" color={c.yellow}>{gel(j.delivery_fee_tetri)}</T>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                        <T size={15} color={c.muted}>№{j.number}{km(j.distance_m) ? ` · ${km(j.distance_m)}` : ''}</T>
                        <T size={15} weight="extrabold" color={cash ? c.ink : c.green}>{cash ? `ნაღდი ${gel(j.total_tetri)}` : 'გადახდილია'}</T>
                      </View>
                    </View>
                    <Stops j={j} full={false} />
                    {showMap ? <MapBox url={mapOf(j)} h={200} /> : null}
                    <Pressable onPress={() => setMapOpen(showMap ? null : j.id)} style={{ minHeight: 44, justifyContent: 'center' }}>
                      <T size={15} weight="extrabold" color={c.muted}>{showMap ? 'რუკის დამალვა' : 'რუკის ნახვა'}</T>
                    </Pressable>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <Btn title="გამოტოვება" kind="ghost" onPress={() => act(j.id, 'courier_decline')} style={{ flex: 1 }} />
                      <Btn title="აღება" busy={busyId === j.id} onPress={() => act(j.id, 'courier_accept', () => { setTab('mine'); setSel(j.id); })} style={{ flex: 1.6 }} />
                    </View>
                  </Card>
                );
              })}
              {offers.length === 0 && !error ? (
                <View style={{ alignItems: 'center', gap: 8, paddingVertical: 60 }}>
                  <Icon name="box" size={44} color={c.muted} />
                  <T size={19} weight="extrabold">ახალი შეკვეთა ჯერ არ არის</T>
                  <T size={15} color={c.muted} style={{ textAlign: 'center' }}>როცა რესტორანი შეკვეთას დაადასტურებს, აქ გამოჩნდება</T>
                </View>
              ) : null}
            </>
          )}

          {tab === 'mine' && (
            <>
              {current ? (() => {
                const j = current;
                const dead = j.status === 'cancelled' || j.status === 'rejected';
                const step = stepOf(j.status);
                const cash = j.payment_method === 'cash';
                return (
                  <>
                    {dead ? (
                      <View style={{ backgroundColor: c.redSoft, borderRadius: 16, padding: 16 }}><T size={20} weight="extrabold" color={c.red}>შეკვეთა გაუქმდა</T></View>
                    ) : (
                      <View style={{ backgroundColor: step === 2 ? c.greenSoft : c.sheet, borderWidth: 1, borderColor: step === 2 ? c.green : c.line, borderRadius: 20, padding: 16, gap: 12 }}>
                        <T size={13} color={c.muted}>№{j.number}</T>
                        <T size={22} weight="extrabold" color={step === 2 ? c.green : c.ink}>{step === 2 ? 'მზადაა, აიღე რესტორანში' : step === 3 ? 'მიიტანე მომხმარებელთან' : 'რესტორანი ამზადებს'}</T>
                        <View style={{ flexDirection: 'row', gap: 5 }}>
                          {STEPS.map((i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? (step === 2 ? c.green : c.yellow) : c.line }} />)}
                        </View>
                      </View>
                    )}
                    {!dead ? (
                      <>
                        <MapBox url={mapOf(j)} />
                        <Card><Stops j={j} full /></Card>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <Btn title="დარეკვა" icon="phone" kind="ghost" disabled={!j.phone} onPress={() => j.phone && Linking.openURL(`tel:${j.phone}`)} style={{ flex: 1 }} />
                          <Btn title="მარშრუტი" icon="map" onPress={() => Linking.openURL(route(j))} style={{ flex: 1 }} />
                        </View>
                        <Card style={{ paddingVertical: 4, gap: 0 }}>
                          <Row label="შეკვეთა" value={gel(j.total_tetri)} />
                          <View style={{ height: 1, backgroundColor: c.line }} />
                          <Row label={cash ? 'აიღე ნაღდი' : 'გადახდა'} value={cash ? gel(j.total_tetri) : 'გადახდილია'} color={cash ? c.yellow : c.green} strong />
                          <View style={{ height: 1, backgroundColor: c.line }} />
                          <Row label="შენი საფასური" value={gel(j.delivery_fee_tetri)} />
                        </Card>
                        {j.status !== 'out_for_delivery' && confirmRelease === j.id ? (
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Btn title="არა" kind="ghost" onPress={() => setConfirmRelease(null)} style={{ flex: 1 }} />
                            <Btn title="დიახ, უარი" busy={busyId === j.id} onPress={() => act(j.id, 'courier_release')} style={{ flex: 2 }} />
                          </View>
                        ) : null}
                        {j.status !== 'out_for_delivery' && confirmRelease !== j.id ? (
                          <Pressable onPress={() => setConfirmRelease(j.id)} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}><T size={15} color={c.muted} style={{ textDecorationLine: 'underline' }}>უარი ამ შეკვეთაზე</T></Pressable>
                        ) : null}
                      </>
                    ) : null}
                  </>
                );
              })() : null}
              {mine.filter((j) => j.id !== current?.id).map((j) => (
                <Pressable key={j.id} onPress={() => setSel(j.id)} style={{ backgroundColor: c.sheet, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}><T size={16} weight="extrabold">№{j.number}</T><T size={14} color={c.muted}>{j.address_snapshot?.street ?? ''}</T></View>
                  <T size={14} weight="extrabold" color={c.yellow}>გახსნა</T>
                </Pressable>
              ))}
              {mine.length === 0 && !error ? (
                <View style={{ alignItems: 'center', gap: 8, paddingVertical: 60 }}>
                  <T size={19} weight="extrabold">აღებული შეკვეთა არ გაქვს</T>
                  <T size={15} color={c.muted} style={{ textAlign: 'center' }}>აირჩიე შეკვეთა „ახალი“ ჩანართიდან</T>
                </View>
              ) : null}
            </>
          )}

          {tab === 'done' && (
            <>
              <View style={{ backgroundColor: c.yellow, borderRadius: 20, padding: 18 }}>
                <T size={15} color={c.dark}>შენი საფასური დღეს</T>
                <T size={40} weight="extrabold" color={c.dark}>{gel(earned)}</T>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1, backgroundColor: c.sheet, borderWidth: 1, borderColor: c.line, borderRadius: 20, padding: 16 }}><T size={14} color={c.muted}>მიტანილი</T><T size={28} weight="extrabold">{String(done.length)}</T></View>
                <View style={{ flex: 1.4, backgroundColor: c.sheet, borderWidth: 1, borderColor: c.line, borderRadius: 20, padding: 16 }}><T size={14} color={c.muted}>აღებული ნაღდი</T><T size={28} weight="extrabold">{gel(cashDone)}</T></View>
              </View>
              {done.map((d) => (
                <View key={d.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.line }}>
                  <View><T size={17} weight="extrabold">№{d.number}</T><T size={14} color={c.muted}>{new Date(d.updated_at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tbilisi' })} · {d.payment_method === 'cash' ? 'ნაღდი' : 'ბარათი'}</T></View>
                  <T size={17} weight="extrabold">{gel(d.total_tetri)}</T>
                </View>
              ))}
              {done.length === 0 ? <T size={16} color={c.muted} style={{ textAlign: 'center', paddingVertical: 30 }}>დღეს ჯერ არაფერი მიგიტანია</T> : null}
            </>
          )}
        </ScrollView>

        {pinned ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 14, backgroundColor: c.bg, borderTopWidth: 1, borderTopColor: c.line }}>
            {pinned.status === 'ready_for_pickup'
              ? <Slide label="გადაასრიალე: აღებულია" busy={busyId === pinned.id} onConfirm={() => act(pinned.id, 'courier_pickup')} />
              : <Slide label="გადაასრიალე: მიტანილია" busy={busyId === pinned.id} onConfirm={() => act(pinned.id, 'courier_mark_delivered')} />}
          </View>
        ) : null}
      </View>
    </View>
  );
}
