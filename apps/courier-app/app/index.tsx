import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../src/supabase';
import { Btn, Divider, Icon, Pill, RoundBtn, T, c, card, gel, type IconName } from '../src/ui';
import { FullMap } from '../src/FullMap';
import { Slide } from '../src/Slide';
import { Breathe, FadeIn, Press, Pulse, SlideUp } from '../src/fx';
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

const mapOf = (j: Job) => {
  const A: Pt | null = j.branch_lat != null && j.branch_lng != null ? { lat: j.branch_lat, lng: j.branch_lng } : null;
  return embedUrl(A, { lat: j.dest_lat, lng: j.dest_lng });
};
const numOf = (n: string) => n.replace(/^.*-0*/, '') || n;

/** Pick-up and drop-off as a vertical timeline. */
function Stops({ j, full }: { j: Job; full: boolean }) {
  const a = j.address_snapshot ?? {};
  const detail = full ? [a.entrance && `სადარბაზო ${a.entrance}`, a.floor && `სართული ${a.floor}`, a.apartment && `ბინა ${a.apartment}`].filter(Boolean).join(', ') : '';
  return (
    <View style={{ flexDirection: 'row', gap: 14 }}>
      <View style={{ alignItems: 'center', paddingTop: 5 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.brand, borderWidth: 3, borderColor: c.ink }} />
        <View style={{ flex: 1, width: 2, backgroundColor: c.line, marginVertical: 4 }} />
        <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: c.ink }} />
      </View>
      <View style={{ flex: 1, gap: 16 }}>
        <View><T size={13} color={c.muted}>აიღე</T><T size={18} weight="extrabold">{j.branch_name}</T>{full && j.branch_address ? <T size={14} color={c.muted}>{j.branch_address}</T> : null}</View>
        <View>
          <T size={13} color={c.muted}>მიიტანე</T><T size={18} weight="extrabold">{a.street ?? '—'}</T>
          {detail ? <T size={14} color={c.muted}>{detail}</T> : null}
          {full && a.comment ? <T size={14} weight="extrabold" color={c.red}>{a.comment}</T> : null}
        </View>
      </View>
    </View>
  );
}

const NavItem = ({ icon, label, on, n, onPress }: { icon: IconName; label: string; on: boolean; n?: number; onPress: () => void }) => (
  <Pressable accessibilityRole="tab" onPress={onPress} style={{ flex: 1, height: 72, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
    <View>
      <Icon name={icon} size={23} color={on ? c.brand : c.muted} />
      {n ? <View style={{ position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: c.red, alignItems: 'center', justifyContent: 'center' }}><T size={11} weight="extrabold" color="#fff">{String(n)}</T></View> : null}
    </View>
    <T size={11} weight={on ? 'extrabold' : 'semibold'} color={on ? c.brand : c.muted}>{label}</T>
    {on ? <View style={{ position: 'absolute', bottom: 7, width: 34, height: 3, borderRadius: 2, backgroundColor: c.brand }} /> : null}
  </Pressable>
);

export default function Home() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [tab, setTab] = useState<'offers' | 'mine' | 'done'>('offers');
  const [feed, setFeed] = useState<Job[]>([]);
  const [done, setDone] = useState<Done[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [name, setName] = useState('');
  const [popId, setPopId] = useState<string | null>(null);
  const dismissed = useRef<Set<string>>(new Set());
  const known = useRef<Map<string, string> | null>(null);
  const onlineRef = useRef(true);
  const toggleOnline = () => { const v = !online; setOnline(v); onlineRef.current = v; supabase.rpc('courier_set_online', { p_online: v }).then(() => undefined, () => undefined); };

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
      if ((newOffer && onlineRef.current) || nowReady) buzz();
    }
    known.current = next;
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      supabase.from('profiles').select('full_name').eq('id', u.user.id).maybeSingle().then(({ data }) => { if (data?.full_name) setName(data.full_name); });
      const d = await supabase.from('orders').select('id,number,total_tetri,delivery_fee_tetri,payment_method,updated_at').eq('courier_id', u.user.id).eq('status', 'delivered').gte('updated_at', dayStart()).order('updated_at', { ascending: false });
      setDone((d.data ?? []) as Done[]);
    }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    const next = (online ? feed.filter((j) => !j.mine) : []).find((j) => !dismissed.current.has(j.id));
    if (!popId && next && tab === 'offers') setPopId(next.id);
    if (popId && !feed.some((j) => j.id === popId && !j.mine)) setPopId(null);
  }, [feed, online, popId, tab]);

  async function act(id: string, fn: string, after?: () => void) {
    setBusyId(id);
    const r = await supabase.rpc(fn, { p_order_id: id });
    setBusyId(null); setConfirmRelease(null);
    if (r.error) setError(msg(r.error.message)); else { setError(''); after?.(); buzz(); }
    await load();
  }

  const offers = online ? feed.filter((j) => !j.mine) : [];
  const mine = feed.filter((j) => j.mine);
  const cashDone = done.filter((d) => d.payment_method === 'cash').reduce((s, d) => s + d.total_tetri, 0);
  const earned = done.reduce((s, d) => s + d.delivery_fee_tetri, 0);
  const current = mine.find((j) => j.id === sel) ?? mine[0];
  const offer = offers.find((j) => j.id === sel) ?? offers[0];


  const route = (j: Job) => (j.branch_lat != null && j.branch_lng != null ? routeUrl({ lat: j.branch_lat, lng: j.branch_lng }, { lat: j.dest_lat, lng: j.dest_lng }) : pointUrl({ lat: j.dest_lat, lng: j.dest_lng }));
  const pinned = tab === 'mine' && current && (current.status === 'ready_for_pickup' || current.status === 'out_for_delivery') ? current : null;
  const showMap = tab === 'mine';
  const firstName = name.trim().split(/\s+/)[0] ?? '';
  const hourAgo = Date.now() - 3600_000;
  const lastHour = done.filter((d) => new Date(d.updated_at).getTime() > hourAgo).reduce((s2, d) => s2 + d.delivery_fee_tetri, 0);
  const popJob = popId ? offers.find((j) => j.id === popId) ?? null : null;
  const mapUrl = tab === 'mine' && current ? mapOf(current) : tab === 'offers' && offer ? mapOf(offer) : embedUrl(null, null);
  const navH = 92 + insets.bottom;
  const maxSheet = Math.round(height * 0.62);

  const go = (k: 'offers' | 'mine' | 'done') => { setTab(k); setSel(null); setConfirmRelease(null); };
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 520, overflow: 'hidden' }}>
        {showMap ? <FullMap url={mapUrl} /> : null}

        {/* floating top bar */}
        {showMap ? (
          <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 12, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Press onPress={toggleOnline} accessibilityRole="button" accessibilityLabel="ონლაინ" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.sheet, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}>
              {error ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.red }} /> : online ? <Pulse color={c.green} size={12} /> : <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.muted }} />}
              <T size={16} weight="extrabold">{error ? 'კავშირი არ არის' : online ? `ონლაინ · ${gel(earned)}` : 'ოფლაინ'}</T>
            </Press>
            <RoundBtn icon="out" label="გასვლა" onPress={() => supabase.auth.signOut({ scope: 'local' })} />
          </View>
        ) : null}


        {tab === 'offers' ? (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: insets.top + 14, paddingHorizontal: 16, paddingBottom: navH + 24, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={c.brand} onRefresh={onRefresh} />}>
            <FadeIn style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.brand, alignItems: 'center', justifyContent: 'center' }}><T size={19} weight="extrabold" color="#fff">{firstName ? firstName.slice(0, 1) : 'Z'}</T></View>
                <View><T size={12} color={c.muted}>გამარჯობა,</T><T size={18} weight="extrabold">{firstName || 'კურიერო'}</T></View>
              </View>
              <RoundBtn icon="out" label="გასვლა" size={44} bg={c.sheet} onPress={() => supabase.auth.signOut({ scope: 'local' })} />
            </FadeIn>
            {error ? <View style={{ backgroundColor: c.redSoft, borderRadius: 14, padding: 14 }}><T size={15} color={c.red}>{error}</T></View> : null}
            <FadeIn delay={80}>
              <Press onPress={toggleOnline} accessibilityRole="button" style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderColor: online ? 'rgba(30,158,106,0.45)' : c.line, backgroundColor: online ? '#DDF1E4' : c.sheet }}>
                {online ? <Pulse color="#1E9E6A" size={14} /> : <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.muted }} />}
                <View style={{ flex: 1 }}><T size={17} weight="extrabold">{online ? 'შენ ონლაინ ხარ' : 'შენ ოფლაინ ხარ'}</T><T size={12.5} color={c.muted}>{online ? 'შეკვეთებს მიიღებ ახლახან' : 'შეკვეთების მისაღებად ჩართე'}</T></View>
                <View style={{ width: 62, height: 34, borderRadius: 17, backgroundColor: online ? '#1E9E6A' : c.line, justifyContent: 'center' }}><View style={{ position: 'absolute', [online ? 'right' : 'left']: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: '#F5F5F1' }} /></View>
              </Press>
            </FadeIn>
            <FadeIn delay={160} style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ ...card, flex: 1.4, padding: 14, backgroundColor: '#D3ECE8' }}>
                <T size={12} color={c.muted}>დღეს გამოიმუშავე</T>
                <T size={30} weight="extrabold" color={c.brand}>{gel(earned)}</T>
                {lastHour > 0 ? <T size={11.5} weight="extrabold" color="#1E9E6A">+{gel(lastHour)} ბოლო საათში</T> : null}
              </View>
              <View style={{ flex: 1, gap: 10 }}>
                <View style={{ ...card, paddingVertical: 10, paddingHorizontal: 14 }}><T size={11.5} color={c.muted}>შეკვეთა</T><T size={19} weight="extrabold">{String(done.length)}</T></View>
                <View style={{ ...card, paddingVertical: 10, paddingHorizontal: 14 }}><T size={11.5} color={c.muted}>ნაღდი ხელზე</T><T size={19} weight="extrabold">{gel(cashDone)}</T></View>
              </View>
            </FadeIn>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
              <T size={18} weight="extrabold">ახალი შეკვეთები</T><T size={12.5} color={c.muted}>სიახლოვის მიხედვით</T>
            </View>
            {offers.map((j, i) => (
              <FadeIn key={j.id} delay={220 + i * 70} from={12}>
                <Press onPress={() => { dismissed.current.delete(j.id); setPopId(j.id); }} style={{ ...card, padding: 14, gap: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', flex: 1 }}>
                      <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center' }}><Icon name="bag" size={20} color={c.brand} /></View>
                      <View style={{ flex: 1 }}><T size={15.5} weight="extrabold">{j.branch_name}</T><T size={12} color={c.muted}>{j.status === 'ready_for_pickup' ? 'აიღე ახლა' : 'მზადდება'} · №{numOf(j.number)}</T></View>
                    </View>
                    <T size={20} weight="extrabold" color={c.brand}>+{gel(j.delivery_fee_tetri)}</T>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                    {km(j.distance_m) ? <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}><Icon name="pin" size={14} color={c.muted} /><T size={12.5} weight="semibold" color={c.muted}>{km(j.distance_m) as string}</T></View> : null}
                    <T size={12.5} weight="semibold" style={{ marginLeft: 'auto' }}>{j.payment_method === 'cash' ? `ნაღდი · ${gel(j.total_tetri)}` : 'გადახდილია'}</T>
                  </View>
                </Press>
              </FadeIn>
            ))}
            {offers.length === 0 && !error ? (
              <FadeIn style={{ alignItems: 'center', gap: 8, paddingVertical: 28 }}>
                {online ? <Pulse color={c.brand} size={22} /> : null}
                <T size={18} weight="extrabold">{online ? 'ველოდებით შეკვეთას…' : 'ოფლაინ ხარ'}</T>
                <T size={14} color={c.muted} style={{ textAlign: 'center' }}>{online ? 'როცა რესტორანი შეკვეთას დაადასტურებს, აქ გამოჩნდება' : 'შეკვეთების მისაღებად ჩართე ონლაინ რეჟიმი'}</T>
              </FadeIn>
            ) : null}
          </ScrollView>
        ) : null}

        {/* done = earnings screen */}
        {tab === 'offers' ? null : tab === 'done' ? (
          <ScrollView style={{ flex: 1, backgroundColor: c.sheet }} contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: navH + 30, gap: 22 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={c.ink} onRefresh={onRefresh} />}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T size={28} weight="extrabold">დღეს</T>
              <RoundBtn icon="out" label="გასვლა" bg={c.soft} onPress={() => supabase.auth.signOut({ scope: 'local' })} />
            </View>
            <View style={{ backgroundColor: c.brand, borderRadius: 24, padding: 22, gap: 4 }}>
              <T size={15} color="#fff">შენი საფასური</T>
              <T size={46} weight="extrabold" color="#fff">{gel(earned)}</T>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, backgroundColor: c.soft, borderRadius: 20, padding: 16 }}><T size={14} color={c.muted}>მიტანილი</T><T size={28} weight="extrabold">{String(done.length)}</T></View>
              <View style={{ flex: 1.3, backgroundColor: c.soft, borderRadius: 20, padding: 16 }}><T size={14} color={c.muted}>აღებული ნაღდი</T><T size={28} weight="extrabold">{gel(cashDone)}</T></View>
            </View>
            <View>
              {done.map((d, i) => (
                <FadeIn key={d.id} delay={i * 60} from={10} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.line }}>
                  <View><T size={17} weight="extrabold">№{numOf(d.number)}</T><T size={14} color={c.muted}>{new Date(d.updated_at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tbilisi' })} · {d.payment_method === 'cash' ? 'ნაღდი' : 'ბარათი'}</T></View>
                  <T size={17} weight="extrabold" color={c.green}>+{gel(d.delivery_fee_tetri)}</T>
                </FadeIn>
              ))}
              {done.length === 0 ? <T size={16} color={c.muted} style={{ textAlign: 'center', paddingVertical: 30 }}>დღეს ჯერ არაფერი მიგიტანია</T> : null}
            </View>
          </ScrollView>
        ) : (
          /* bottom sheet over the map */
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: navH, backgroundColor: c.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}><View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: c.line }} /></View>
            <ScrollView style={{ maxHeight: maxSheet }} contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 8, paddingBottom: 16, gap: 18 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={c.ink} onRefresh={onRefresh} />}>
              {error ? <View style={{ backgroundColor: c.redSoft, borderRadius: 14, padding: 14 }}><T size={15} color={c.red}>{error}</T></View> : null}

              {tab === 'mine' && current ? (() => {
                const j = current;
                const dead = j.status === 'cancelled' || j.status === 'rejected';
                const step = stepOf(j.status);
                const cash = j.payment_method === 'cash';
                const say = dead ? 'შეკვეთა გაუქმდა' : step === 2 ? 'მზადაა, აიღე რესტორანში' : step === 3 ? 'მიიტანე მომხმარებელთან' : 'რესტორანი ამზადებს';
                return (
                  <>
                    <View style={{ gap: 10 }}>
                      <T size={14} color={c.muted}>შეკვეთა №{numOf(j.number)}</T>
                      <T size={24} weight="extrabold" color={dead ? c.red : step === 2 ? c.green : c.ink}>{say}</T>
                      {!dead ? <View style={{ flexDirection: 'row', gap: 5 }}>{STEPS.map((i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? (step === 2 ? c.green : c.brand) : c.line }} />)}</View> : null}
                    </View>
                    {!dead ? (
                      <>
                        <Stops j={j} full />
                        <Divider />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ flex: 1 }}><T size={13} color={c.muted}>მომხმარებელი</T><T size={18} weight="extrabold">{j.full_name ?? 'მომხმარებელი'}</T></View>
                          <RoundBtn icon="phone" label="დარეკვა" size={52} bg={c.soft} disabled={!j.phone} onPress={() => j.phone && Linking.openURL(`tel:${j.phone}`)} />
                          <RoundBtn icon="nav" label="მარშრუტი" size={52} bg={c.brand} onPress={() => Linking.openURL(route(j))} />
                        </View>
                        <Divider />
                        <View style={{ gap: 12 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T size={16} color={c.muted}>შეკვეთა</T><T size={17} weight="extrabold">{gel(j.total_tetri)}</T></View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: cash ? c.brandSoft : c.greenSoft, borderRadius: 14, padding: 14 }}>
                            <T size={16} weight="extrabold">{cash ? 'აიღე ნაღდი' : 'გადახდილია'}</T><T size={22} weight="extrabold" color={cash ? c.ink : c.green}>{cash ? gel(j.total_tetri) : '✓'}</T>
                          </View>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T size={16} color={c.muted}>შენი საფასური</T><T size={17} weight="extrabold">{gel(j.delivery_fee_tetri)}</T></View>
                        </View>
                        {j.status !== 'out_for_delivery' && confirmRelease === j.id ? (
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Btn title="არა" kind="soft" onPress={() => setConfirmRelease(null)} style={{ flex: 1 }} />
                            <Btn title="დიახ, უარი" kind="dark" busy={busyId === j.id} onPress={() => act(j.id, 'courier_release')} style={{ flex: 2 }} />
                          </View>
                        ) : null}
                        {j.status !== 'out_for_delivery' && confirmRelease !== j.id ? (
                          <Pressable onPress={() => setConfirmRelease(j.id)} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><T size={15} color={c.muted} style={{ textDecorationLine: 'underline' }}>უარი ამ შეკვეთაზე</T></Pressable>
                        ) : null}
                      </>
                    ) : null}
                    {mine.length > 1 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <T size={14} color={c.muted}>ჩემი შეკვეთები:</T>
                        {mine.map((o) => <Pressable key={o.id} onPress={() => setSel(o.id)} style={{ minWidth: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: o.id === j.id ? c.ink : c.soft, paddingHorizontal: 8 }}><T size={14} weight="extrabold" color={o.id === j.id ? '#fff' : c.ink}>{numOf(o.number)}</T></Pressable>)}
                      </View>
                    ) : null}
                  </>
                );
              })() : null}
              {tab === 'mine' && !current && !error ? (
                <View style={{ alignItems: 'center', gap: 6, paddingVertical: 24 }}>
                  <T size={20} weight="extrabold">აღებული შეკვეთა არ გაქვს</T>
                  <T size={15} color={c.muted} style={{ textAlign: 'center' }}>აირჩიე შეკვეთა „ახალი“ განყოფილებიდან</T>
                </View>
              ) : null}
            </ScrollView>
            {pinned ? (
              <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 14, borderTopWidth: 1, borderTopColor: c.line }}>
                {pinned.status === 'ready_for_pickup'
                  ? <Slide label="გადაასრიალე: აღებულია" busy={busyId === pinned.id} onConfirm={() => act(pinned.id, 'courier_pickup')} />
                  : <Slide label="გადაასრიალე: მიტანილია" busy={busyId === pinned.id} onConfirm={() => act(pinned.id, 'courier_mark_delivered')} />}
              </View>
            ) : null}
          </View>
        )}

        {/* new order popup */}
        {popJob ? (() => {
          const j = popJob; const cash = j.payment_method === 'cash'; const a = j.address_snapshot ?? {};
          const close = () => { dismissed.current.add(j.id); setPopId(null); };
          return (
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 20, justifyContent: 'flex-end' }}>
              <FadeIn from={0} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}><Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(23,26,27,0.72)' }} /></FadeIn>
              <SlideUp k={j.id} style={{ marginHorizontal: 8, marginBottom: 8 + insets.bottom, ...card, borderColor: 'rgba(11,167,154,0.45)', borderRadius: 30, padding: 16, gap: 12, backgroundColor: c.sheet }}>
                <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: c.line, alignSelf: 'center' }} />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Breathe><View style={{ backgroundColor: 'rgba(11,167,154,0.14)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', gap: 6, alignItems: 'center' }}><Icon name="bell" size={13} color={c.brand} /><T size={11} weight="extrabold" color={c.brand}>ახალი შეკვეთა</T></View></Breathe>
                  <T size={13} weight="extrabold" color={c.muted}>№{numOf(j.number)}</T>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <View><T size={12.5} color={c.muted}>შენი შემოსავალი</T><T size={42} weight="extrabold" color={c.brand} style={{ lineHeight: 48 }}>{gel(j.delivery_fee_tetri)}</T></View>
                  {km(j.distance_m) ? <View style={{ alignItems: 'flex-end' }}><T size={12.5} color={c.muted}>მანძილი</T><T size={16} weight="extrabold">{km(j.distance_m) as string}</T></View> : null}
                </View>
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#2FC4B6' }} />
                    <View style={{ flex: 1 }}><T size={11.5} color={c.muted}>აიღე</T><T size={14} weight="extrabold">{j.branch_name}{j.branch_address ? ` · ${j.branch_address}` : ''}</T></View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.brand }} />
                    <View style={{ flex: 1 }}><T size={11.5} color={c.muted}>მიიტანე</T><T size={14} weight="extrabold">{a.street ?? '—'}</T></View>
                    <View style={{ backgroundColor: cash ? 'rgba(242,169,0,0.14)' : c.greenSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}><T size={12} weight="extrabold" color={cash ? '#B57F00' : c.green}>{cash ? `ნაღდი ${gel(j.total_tetri)}` : 'გადახდილია'}</T></View>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Btn title="უარი" kind="soft" onPress={() => { dismissed.current.add(j.id); setPopId(null); act(j.id, 'courier_decline'); }} style={{ flex: 1, height: 56 }} />
                  <Breathe style={{ flex: 2.2 }}><Btn title="დადასტურება ✓" busy={busyId === j.id} onPress={() => act(j.id, 'courier_accept', () => { dismissed.current.add(j.id); setPopId(null); setTab('mine'); setSel(j.id); })} /></Breathe>
                </View>
              </SlideUp>
            </View>
          );
        })() : null}

        {/* bottom navigation */}
        <View style={{ position: 'absolute', left: 10, right: 10, bottom: 10 + insets.bottom, height: 72, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(245,245,241,0.94)', borderWidth: 1, borderColor: 'rgba(11,167,154,0.22)', borderRadius: 28, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10, zIndex: 10 }}>
          <NavItem icon="home" label="მთავარი" on={tab === 'offers'} n={offers.length} onPress={() => go('offers')} />
          <NavItem icon="list" label="ჩემი" on={tab === 'mine'} n={mine.length} onPress={() => go('mine')} />
          <NavItem icon="wallet" label="დღეს" on={tab === 'done'} onPress={() => go('done')} />
        </View>
      </View>
    </View>
  );
}
