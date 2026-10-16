import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, PanResponder, Platform, Pressable, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors } from '@gochits/ui-tokens';
import { supabase } from '../src/supabase';
import { Btn, Icon, T, c, gel } from '../src/ui';
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
const STEPS = ['აღებულია', 'მზადდება', 'მზადაა', 'გზაშია'];
const stepOf = (s: string) => (s === 'out_for_delivery' ? 3 : s === 'ready_for_pickup' ? 2 : s === 'preparing' || s === 'accepted' ? 1 : 0);

const Chip = ({ children, bg = c.soft, fg = c.ink }: { children: string; bg?: string; fg?: string }) => (
  <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}><T size={13} weight="extrabold" color={fg}>{children}</T></View>
);

/** Order value, cash to collect, and the courier's fee (the delivery fee). */
function Money({ j }: { j: Job }) {
  const cash = j.payment_method === 'cash';
  const cell = (label: string, value: string, bg: string, fg: string = c.ink) => (
    <View style={{ flex: 1, backgroundColor: bg, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10 }}><T size={11} color={fg === c.ink ? c.muted : fg}>{label}</T><T size={17} weight="extrabold" color={fg}>{value}</T></View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {cell('შეკვეთა', gel(j.total_tetri), c.sheet)}
      {cell(cash ? 'აიღებ ნაღდს' : 'გადახდილია', cash ? gel(j.total_tetri) : gel(0), cash ? c.yellow : c.greenSoft, cash ? c.ink : c.green)}
      {cell('შენი საფასური', gel(j.delivery_fee_tetri), c.ink, '#fff')}
    </View>
  );
}

/** A -> B route as a vertical timeline. */
function Trip({ j, full }: { j: Job; full: boolean }) {
  const a = j.address_snapshot ?? {};
  const detail = full ? [a.entrance && `სადარბაზო ${a.entrance}`, a.floor && `სართული ${a.floor}`, a.apartment && `ბინა ${a.apartment}`].filter(Boolean).join(' · ') : '';
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center', paddingTop: 4 }}>
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.yellow, borderWidth: 3, borderColor: c.ink }} />
        <View style={{ flex: 1, width: 2, backgroundColor: c.line, marginVertical: 4 }} />
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.green }} />
      </View>
      <View style={{ flex: 1, gap: 14 }}>
        <View><T size={12} color={c.muted}>აიღე</T><T size={16} weight="extrabold">{j.branch_name}</T>{j.branch_address ? <T size={13} color={c.muted}>{j.branch_address}</T> : null}</View>
        <View>
          <T size={12} color={c.muted}>მიიტანე</T><T size={16} weight="extrabold">{a.street ?? '—'}</T>
          {detail ? <T size={13} color={c.muted}>{detail}</T> : null}
          {full && a.comment ? <T size={13} color="#B5790A">💬 {a.comment}</T> : null}
        </View>
      </View>
    </View>
  );
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [tab, setTab] = useState<'offers' | 'mine' | 'done'>('offers');
  const [feed, setFeed] = useState<Job[]>([]);
  const [done, setDone] = useState<Done[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
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
  const list = tab === 'offers' ? offers : tab === 'mine' ? mine : [];
  const current = list.find((j) => j.id === sel) ?? (tab === 'mine' ? mine[0] : undefined);

  const mapUrl = useMemo(() => {
    if (tab === 'done') return embedUrl(null, null);
    const first = current ?? offers[0];
    if (!first) return embedUrl(null, null);
    const A: Pt | null = first.branch_lat != null && first.branch_lng != null ? { lat: first.branch_lat, lng: first.branch_lng } : null;
    return current ? embedUrl(A, { lat: first.dest_lat, lng: first.dest_lng }) : embedUrl(A, null);
  }, [tab, current, offers]);  // eslint-disable-line react-hooks/exhaustive-deps

  // bottom sheet: tap or drag the handle
  const sheetH = Math.round(height * (open ? 0.66 : 0.4));
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderRelease: (_, g) => { if (g.dy < -25) setOpen(true); else if (g.dy > 25) setOpen(false); else setOpen((o) => !o); },
  })).current;

  const tabs = [['offers', 'ახალი', offers.length], ['mine', 'ჩემი', mine.length], ['done', 'დღეს', done.length]] as const;
  const route = (j: Job) => (j.branch_lat != null && j.branch_lng != null ? routeUrl({ lat: j.branch_lat, lng: j.branch_lng }, { lat: j.dest_lat, lng: j.dest_lng }) : pointUrl({ lat: j.dest_lat, lng: j.dest_lng }));

  return (
    <View style={{ flex: 1, backgroundColor: '#EFE9DA', alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 520, overflow: 'hidden' }}>
        <FullMap url={mapUrl} />

        {/* floating top bar */}
        <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 10, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ backgroundColor: c.sheet, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}>
            <Image source={require('../assets/logo.png')} style={{ width: 62, height: 30 }} resizeMode="contain" />
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: error ? c.red : c.green }} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="გასვლა" onPress={() => supabase.auth.signOut({ scope: 'local' })} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.sheet, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}>
            <Icon name="out" color={c.ink} size={20} />
          </Pressable>
        </View>

        {/* bottom sheet */}
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: sheetH, backgroundColor: c.sheet, borderTopLeftRadius: 28, borderTopRightRadius: 28, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: -4 }, elevation: 12 }}>
          <View {...pan.panHandlers} style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}><View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: c.line }} /></View>
          <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 10, backgroundColor: c.soft, borderRadius: 999, padding: 4 }}>
            {tabs.map(([k, label, n]) => (
              <Pressable key={k} onPress={() => { setTab(k); setSel(null); setConfirmRelease(null); if (k === 'mine') setOpen(true); }} style={{ flex: 1, minHeight: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: tab === k ? c.sheet : 'transparent' }}>
                <T size={14} weight="extrabold" color={tab === k ? c.ink : c.muted}>{label}</T>
                {n > 0 ? <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: k === 'offers' ? colors.red : c.yellow }}><T size={11} weight="extrabold" color={k === 'offers' ? '#fff' : c.ink}>{String(n)}</T></View> : null}
              </Pressable>
            ))}
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20, gap: 14 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.ink} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
            {error ? <View style={{ backgroundColor: '#FDE6E6', borderRadius: 14, padding: 12 }}><T size={14} color={c.red}>{error}</T></View> : null}

            {tab === 'offers' && (
              <>
                {offers.map((j) => {
                  const isSel = current?.id === j.id;
                  return (
                    <Pressable key={j.id} onPress={() => { setSel(isSel ? null : j.id); if (!isSel) setOpen(true); }} style={{ borderRadius: 22, padding: 14, gap: 12, backgroundColor: isSel ? '#FFF8DB' : c.soft, borderWidth: 2, borderColor: isSel ? c.yellow : 'transparent' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <T size={18} weight="extrabold">№{j.number}</T>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {km(j.distance_m) ? <Chip>{km(j.distance_m) as string}</Chip> : null}
                        </View>
                      </View>
                      <Trip j={j} full={false} />
                      <Money j={j} />
                      {isSel ? (
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <Btn title="გამოტოვება" kind="ghost" onPress={() => act(j.id, 'courier_decline', () => setSel(null))} style={{ flex: 1 }} />
                          <Btn title="აღება" icon="check" busy={busyId === j.id} onPress={() => act(j.id, 'courier_accept', () => { setTab('mine'); setSel(j.id); })} style={{ flex: 2 }} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
                {offers.length === 0 && !error ? (
                  <View style={{ alignItems: 'center', gap: 8, paddingVertical: 30 }}>
                    <Icon name="box" size={40} color={c.line} />
                    <T size={16} weight="extrabold">ახალი შეკვეთა ჯერ არ არის</T>
                    <T size={13} color={c.muted}>როცა შეკვეთა შემოვა, აქ თავისით გამოჩნდება</T>
                  </View>
                ) : null}
              </>
            )}

            {tab === 'mine' && (
              <>
                {mine.map((j) => {
                  const dead = j.status === 'cancelled' || j.status === 'rejected';
                  const step = stepOf(j.status);
                  const isCur = current?.id === j.id;
                  return (
                    <Pressable key={j.id} onPress={() => setSel(j.id)} style={{ borderRadius: 22, padding: 14, gap: 14, backgroundColor: c.soft, borderWidth: 2, borderColor: isCur ? c.yellow : 'transparent' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <T size={18} weight="extrabold">№{j.number}</T>
                        <T size={13} color={c.muted}>{km(j.distance_m) ?? ''}</T>
                      </View>
                      {dead ? (
                        <View style={{ backgroundColor: '#FDE6E6', borderRadius: 14, padding: 12 }}><T size={15} weight="extrabold" color={c.red}>შეკვეთა გაუქმდა</T></View>
                      ) : (
                        <>
                          <View style={{ gap: 6 }}>
                            <View style={{ flexDirection: 'row', gap: 4 }}>
                              {STEPS.map((_, i) => <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? (step === 2 ? c.green : c.yellow) : c.line }} />)}
                            </View>
                            <T size={14} weight="extrabold" color={step === 2 ? c.green : c.ink}>{step === 2 ? 'მზადაა! აიღე შეკვეთა რესტორანში და დააჭირე ღილაკს' : step === 3 ? 'გზაშია, მიიტანე მომხმარებელთან' : 'რესტორანი ამზადებს, მოემზადე'}</T>
                          </View>
                          <Trip j={j} full />
                          <Money j={j} />
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Btn title={j.full_name ?? 'მომხმარებელი'} icon="phone" kind="ghost" disabled={!j.phone} onPress={() => j.phone && Linking.openURL(`tel:${j.phone}`)} style={{ flex: 1 }} />
                            <Btn title="მარშრუტი" icon="map" kind="primary" onPress={() => Linking.openURL(route(j))} style={{ flex: 1 }} />
                          </View>
                          {error ? <T size={13} color={c.red}>{error}</T> : null}
                          {j.status === 'ready_for_pickup' ? (
                            <Slide label="გადაასრიალე: აღებულია" busy={busyId === j.id} onConfirm={() => act(j.id, 'courier_pickup')} />
                          ) : j.status === 'out_for_delivery' ? (
                            <Slide label="გადაასრიალე: მიტანილია" busy={busyId === j.id} onConfirm={() => act(j.id, 'courier_mark_delivered')} />
                          ) : null}
                          {j.status !== 'out_for_delivery' && confirmRelease === j.id ? (
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                              <Btn title="არა" kind="ghost" onPress={() => setConfirmRelease(null)} style={{ flex: 1 }} />
                              <Btn title="დიახ, უარი" busy={busyId === j.id} onPress={() => act(j.id, 'courier_release')} style={{ flex: 2 }} />
                            </View>
                          ) : null}
                          {j.status !== 'out_for_delivery' && confirmRelease !== j.id ? (
                            <Pressable onPress={() => setConfirmRelease(j.id)} style={{ alignItems: 'center', padding: 6 }}><T size={13} color={c.muted} style={{ textDecorationLine: 'underline' }}>უარი ამ შეკვეთაზე</T></Pressable>
                          ) : null}
                        </>
                      )}
                    </Pressable>
                  );
                })}
                {mine.length === 0 && !error ? <T color={c.muted} style={{ textAlign: 'center', paddingVertical: 30 }}>აღებული შეკვეთა არ გაქვს. „ახალი“-დან აიღე.</T> : null}
              </>
            )}

            {tab === 'done' && (
              <>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1, backgroundColor: c.soft, borderRadius: 20, padding: 14 }}><T size={12} color={c.muted}>მიტანილი</T><T size={28} weight="extrabold">{String(done.length)}</T></View>
                  <View style={{ flex: 1.4, backgroundColor: c.yellow, borderRadius: 20, padding: 14 }}><T size={12} color={c.ink}>აღებული ნაღდი</T><T size={28} weight="extrabold">{gel(cashDone)}</T></View>
                </View>
                <View style={{ backgroundColor: c.ink, borderRadius: 20, padding: 14 }}><T size={12} color="#d9cfc2">შენი საფასური დღეს</T><T size={28} weight="extrabold" color="#fff">{gel(earned)}</T></View>
                {done.map((d) => (
                  <View key={d.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.line }}>
                    <View><T weight="extrabold">№{d.number}</T><T size={13} color={c.muted}>{new Date(d.updated_at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tbilisi' })} · {d.payment_method === 'cash' ? 'ნაღდი' : 'ბარათი'}</T></View>
                    <T weight="extrabold">{gel(d.total_tetri)}</T>
                  </View>
                ))}
                {done.length === 0 ? <T color={c.muted} style={{ textAlign: 'center', paddingVertical: 20 }}>დღეს ჯერ არაფერი მიგიტანია</T> : null}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
