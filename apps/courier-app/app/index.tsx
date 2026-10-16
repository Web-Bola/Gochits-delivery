import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { supabase } from '../src/supabase';
import { Btn, Icon, Line, Pad, Perf, Stamp, Stripe, T, Ticket, c, gel } from '../src/ui';
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

const mapOf = (j: Job) => {
  const A: Pt | null = j.branch_lat != null && j.branch_lng != null ? { lat: j.branch_lat, lng: j.branch_lng } : null;
  return embedUrl(A, { lat: j.dest_lat, lng: j.dest_lng });
};
const MapBox = ({ url, h = 220 }: { url: string; h?: number }) => (
  <View style={{ height: h, borderRadius: 4, borderWidth: 2, borderColor: c.pInk, overflow: 'hidden', backgroundColor: '#E8DFC4' }}><FullMap url={url} /></View>
);
const numOf = (n: string) => n.replace(/^.*-0*/, '') || n;

const Marker = ({ ch }: { ch: string }) => (
  <View style={{ width: 30, height: 30, borderRadius: 6, backgroundColor: c.pInk, alignItems: 'center', justifyContent: 'center' }}><T size={16} weight="extrabold" color={c.yellow}>{ch}</T></View>
);

/** A -> B with a dotted line between the markers, like a map legend. */
function Stops({ j, full }: { j: Job; full: boolean }) {
  const a = j.address_snapshot ?? {};
  const detail = full ? [a.entrance && `სადარბაზო ${a.entrance}`, a.floor && `სართული ${a.floor}`, a.apartment && `ბინა ${a.apartment}`].filter(Boolean).join(', ') : '';
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <Marker ch="ა" />
        <View style={{ flex: 1, borderLeftWidth: 3, borderStyle: 'dotted', borderColor: c.pInk, marginVertical: 3 }} />
        <Marker ch="ბ" />
      </View>
      <View style={{ flex: 1, justifyContent: 'space-between', gap: 14 }}>
        <View><T size={13} color={c.pMuted}>აიღე</T><T size={19} weight="extrabold" color={c.pInk}>{j.branch_name}</T>{full && j.branch_address ? <T size={15} color={c.pMuted}>{j.branch_address}</T> : null}</View>
        <View>
          <T size={13} color={c.pMuted}>მიიტანე</T><T size={19} weight="extrabold" color={c.pInk}>{a.street ?? '—'}</T>
          {detail ? <T size={15} color={c.pMuted}>{detail}</T> : null}
          {full && a.comment ? <T size={15} weight="extrabold" color={c.pRed}>კომენტარი: {a.comment}</T> : null}
        </View>
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
  const STEP_LABEL = ['მიღებული', 'მზადდება', 'მზადაა', 'გზაში'];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 520 }}>
        <View style={{ paddingTop: insets.top }}><Stripe height={12} /></View>
        {/* header */}
        <View style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <Image source={require('../assets/logo.png')} style={{ width: 76, height: 40 }} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <T size={15} weight="extrabold" color={c.yellow}>დღეს: {done.length} მიტანა · {gel(earned)}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: error ? c.redText : c.green }} />
                <T size={13} color={c.muted}>{error ? 'კავშირი არ არის' : 'ონლაინ'}</T>
              </View>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="გასვლა" onPress={() => supabase.auth.signOut({ scope: 'local' })} style={{ width: 48, height: 48, borderRadius: 8, borderWidth: 2, borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="out" color={c.ink} size={22} />
          </Pressable>
        </View>

        {/* tabs */}
        <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 14 }}>
          {tabs.map(([k, label, n]) => {
            const on = tab === k;
            return (
              <Pressable key={k} accessibilityRole="tab" onPress={() => { setTab(k); setSel(null); setConfirmRelease(null); }} style={{ flex: 1 }}>
                {on ? <View style={{ position: 'absolute', left: 4, top: 4, right: -4, bottom: -4, borderRadius: 8, backgroundColor: c.red }} /> : null}
                <View style={{ minHeight: 52, borderRadius: 8, borderWidth: 2, borderColor: on ? c.pInk : c.line, backgroundColor: on ? c.yellow : 'transparent', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
                  <T size={17} weight="extrabold" color={on ? c.pInk : c.ink}>{label}</T>
                  {n > 0 && k !== 'done' ? <View style={{ minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.pInk : c.red }}><T size={13} weight="extrabold" color={on ? c.yellow : '#fff'}>{String(n)}</T></View> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30, gap: 18 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={c.yellow} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
          {error ? <View style={{ borderWidth: 2, borderColor: c.redText, borderRadius: 8, padding: 14 }}><T size={15} color={c.redText}>{error}</T></View> : null}

          {tab === 'offers' && (
            <>
              {offers.map((j) => {
                const cash = j.payment_method === 'cash';
                const showMap = mapOpen === j.id;
                return (
                  <Ticket key={j.id}>
                    <Pad style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <T size={13} color={c.pMuted}>შეკვეთა</T>
                        <T size={40} weight="extrabold" color={c.pInk} style={{ lineHeight: 46 }}>№{numOf(j.number)}</T>
                      </View>
                      <Stamp text={cash ? `ნაღდი ${gel(j.total_tetri)}` : 'გადახდილია'} color={cash ? c.pRed : c.pGreen} />
                    </Pad>
                    <Perf />
                    <Pad>
                      <Stops j={j} full={false} />
                      {showMap ? <MapBox url={mapOf(j)} h={200} /> : null}
                      <Pressable onPress={() => setMapOpen(showMap ? null : j.id)} style={{ minHeight: 40, justifyContent: 'center' }}>
                        <T size={15} weight="extrabold" color={c.pInk} style={{ textDecorationLine: 'underline' }}>{showMap ? 'რუკის დამალვა' : 'რუკის ნახვა'}</T>
                      </Pressable>
                    </Pad>
                    <Perf />
                    <Pad>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <View><T size={13} color={c.pMuted}>შენი საფასური</T><T size={36} weight="extrabold" color={c.pInk} style={{ lineHeight: 42 }}>{gel(j.delivery_fee_tetri)}</T></View>
                        {km(j.distance_m) ? <T size={17} weight="extrabold" color={c.pInk}>{km(j.distance_m)}</T> : null}
                      </View>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <Btn title="გამოტოვება" kind="line" onPress={() => act(j.id, 'courier_decline')} style={{ flex: 1 }} />
                        <Btn title="აღება" kind="ink" busy={busyId === j.id} onPress={() => act(j.id, 'courier_accept', () => { setTab('mine'); setSel(j.id); })} style={{ flex: 1.5 }} />
                      </View>
                    </Pad>
                  </Ticket>
                );
              })}
              {offers.length === 0 && !error ? (
                <View style={{ alignItems: 'center', gap: 8, paddingVertical: 60 }}>
                  <Icon name="box" size={44} color={c.yellow} />
                  <T size={20} weight="extrabold">ახალი შეკვეთა ჯერ არ არის</T>
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
                const say = step === 2 ? 'მზადაა, აიღე რესტორანში' : step === 3 ? 'მიიტანე მომხმარებელთან' : 'რესტორანი ამზადებს';
                return (
                  <Ticket>
                    <Pad style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View><T size={13} color={c.pMuted}>შეკვეთა</T><T size={40} weight="extrabold" color={c.pInk} style={{ lineHeight: 46 }}>№{numOf(j.number)}</T></View>
                      {dead ? <Stamp text="გაუქმდა" color={c.pRed} /> : <Stamp text={cash ? 'ნაღდი' : 'გადახდილია'} color={cash ? c.pRed : c.pGreen} />}
                    </Pad>
                    {!dead ? (
                      <Pad>
                        <View style={{ alignSelf: 'flex-start', backgroundColor: c.yellow, paddingHorizontal: 8, paddingVertical: 3 }}><T size={20} weight="extrabold" color={c.pInk}>{say}</T></View>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {STEP_LABEL.map((l, i) => (
                            <View key={l} style={{ flex: 1, gap: 4 }}>
                              <View style={{ height: 10, borderRadius: 2, borderWidth: 2, borderColor: c.pInk, backgroundColor: i < step ? c.pInk : i === step ? c.yellow : 'transparent' }} />
                              <T size={12} weight={i === step ? 'extrabold' : 'regular'} color={i <= step ? c.pInk : c.pMuted}>{l}</T>
                            </View>
                          ))}
                        </View>
                      </Pad>
                    ) : null}
                    {!dead ? (
                      <>
                        <Perf />
                        <Pad>
                          <MapBox url={mapOf(j)} />
                          <Stops j={j} full />
                          <View style={{ flexDirection: 'row', gap: 10 }}>
                            <Btn title="დარეკვა" icon="phone" kind="line" disabled={!j.phone} onPress={() => j.phone && Linking.openURL(`tel:${j.phone}`)} style={{ flex: 1 }} />
                            <Btn title="მარშრუტი" icon="map" kind="ink" onPress={() => Linking.openURL(route(j))} style={{ flex: 1 }} />
                          </View>
                        </Pad>
                        <Perf />
                        <Pad style={{ gap: 8 }}>
                          <Line label="შეკვეთა" value={gel(j.total_tetri)} />
                          <Line label={cash ? 'აიღე ნაღდი' : 'გადახდა'} value={cash ? gel(j.total_tetri) : 'გადახდილია'} strong color={cash ? c.pRed : c.pGreen} />
                          <Line label="შენი საფასური" value={gel(j.delivery_fee_tetri)} />
                        </Pad>
                        <Pad>
                          {j.status !== 'out_for_delivery' && confirmRelease === j.id ? (
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                              <Btn title="არა" kind="line" onPress={() => setConfirmRelease(null)} style={{ flex: 1 }} />
                              <Btn title="დიახ, უარი" kind="ink" busy={busyId === j.id} onPress={() => act(j.id, 'courier_release')} style={{ flex: 2 }} />
                            </View>
                          ) : null}
                          {j.status !== 'out_for_delivery' && confirmRelease !== j.id ? (
                            <Pressable onPress={() => setConfirmRelease(j.id)} style={{ minHeight: 44, justifyContent: 'center' }}><T size={15} color={c.pMuted} style={{ textDecorationLine: 'underline' }}>უარი ამ შეკვეთაზე</T></Pressable>
                          ) : null}
                        </Pad>
                      </>
                    ) : null}
                  </Ticket>
                );
              })() : null}
              {mine.filter((j) => j.id !== current?.id).map((j) => (
                <Pressable key={j.id} onPress={() => setSel(j.id)} style={{ borderWidth: 2, borderColor: c.line, borderRadius: 8, padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1 }}><T size={18} weight="extrabold">№{numOf(j.number)}</T><T size={14} color={c.muted}>{j.address_snapshot?.street ?? ''}</T></View>
                  <T size={15} weight="extrabold" color={c.yellow}>გახსნა</T>
                </Pressable>
              ))}
              {mine.length === 0 && !error ? (
                <View style={{ alignItems: 'center', gap: 8, paddingVertical: 60 }}>
                  <T size={20} weight="extrabold">აღებული შეკვეთა არ გაქვს</T>
                  <T size={15} color={c.muted} style={{ textAlign: 'center' }}>აირჩიე შეკვეთა „ახალი“ ჩანართიდან</T>
                </View>
              ) : null}
            </>
          )}

          {tab === 'done' && (
            <Ticket>
              <Pad>
                <T size={13} color={c.pMuted}>დღის შეჯამება</T>
                <Line label="მიტანილი" value={String(done.length)} />
                <Line label="აღებული ნაღდი" value={gel(cashDone)} />
              </Pad>
              <Perf />
              <Pad>
                <T size={13} color={c.pMuted}>შენი საფასური დღეს</T>
                <T size={48} weight="extrabold" color={c.pInk} style={{ lineHeight: 54 }}>{gel(earned)}</T>
              </Pad>
              {done.length > 0 ? <Perf /> : null}
              <Pad style={{ gap: 8 }}>
                {done.map((d) => (
                  <Line key={d.id} label={`№${numOf(d.number)} · ${new Date(d.updated_at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tbilisi' })} · ${d.payment_method === 'cash' ? 'ნაღდი' : 'ბარათი'}`} value={gel(d.total_tetri)} />
                ))}
                {done.length === 0 ? <T size={16} color={c.pMuted}>დღეს ჯერ არაფერი მიგიტანია</T> : null}
              </Pad>
            </Ticket>
          )}
        </ScrollView>

        {pinned ? (
          <View style={{ backgroundColor: c.bg }}>
            <Stripe height={8} />
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: insets.bottom + 14 }}>
              {pinned.status === 'ready_for_pickup'
                ? <Slide label="გადაასრიალე: აღებულია" busy={busyId === pinned.id} onConfirm={() => act(pinned.id, 'courier_pickup')} />
                : <Slide label="გადაასრიალე: მიტანილია" busy={busyId === pinned.id} onConfirm={() => act(pinned.id, 'courier_mark_delivered')} />}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}
