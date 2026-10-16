import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors, theme } from '@gochits/ui-tokens';
import { supabase } from '../src/supabase';
import { Btn, Card, Icon, T, gel } from '../src/ui';

interface Snap { street?: string; entrance?: string | null; floor?: string | null; apartment?: string | null; comment?: string | null }
interface Job { id: string; number: string; branch_name: string; address_snapshot: Snap; phone: string | null; full_name: string | null; total_tetri: number; payment_method: 'card' | 'cash'; payment_status: string }
interface Done { id: string; number: string; total_tetri: number; payment_method: 'card' | 'cash'; updated_at: string }

const dayStart = () => new Date(`${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tbilisi' })}T00:00:00+04:00`).toISOString();

export default function Home() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'jobs' | 'done'>('jobs');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [done, setDone] = useState<Done[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const r = await supabase.rpc('courier_deliveries');
    if (r.error) { setError(/forbidden/.test(r.error.message) ? 'ამ ანგარიშს კურიერის უფლება არ აქვს' : 'ვერ ჩაიტვირთა. შეამოწმე ინტერნეტი.'); return; }
    const list = (r.data ?? []) as Job[];
    setError('');
    setJobs(list);
    const ids = new Set(list.map((j) => j.id));
    if (known.current && list.some((j) => !known.current!.has(j.id))) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    known.current = ids;
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      const d = await supabase.from('orders').select('id,number,total_tetri,payment_method,updated_at').eq('courier_id', u.user.id).eq('status', 'delivered').gte('updated_at', dayStart()).order('updated_at', { ascending: false });
      setDone((d.data ?? []) as Done[]);
    }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]);

  async function deliver(j: Job) {
    setBusyId(j.id);
    const r = await supabase.rpc('courier_mark_delivered', { p_order_id: j.id });
    setBusyId(null); setConfirm(null);
    if (r.error) { setError('ვერ შეინახა: ' + r.error.message); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    await load();
  }

  const cashDone = done.filter((d) => d.payment_method === 'cash').reduce((s, d) => s + d.total_tetri, 0);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ backgroundColor: colors.yellow, paddingTop: insets.top + 10, paddingBottom: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
        <Image source={require('../assets/logo.png')} style={{ width: 96, height: 48 }} resizeMode="contain" />
        <Pressable accessibilityRole="button" accessibilityLabel="გასვლა" onPress={() => supabase.auth.signOut()} style={{ padding: 10 }}><Icon name="out" color={colors.ink} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, padding: 14 }}>
        {([['jobs', `გასატანი · ${jobs.length}`], ['done', `დღეს მიტანილი · ${done.length}`]] as const).map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={{ flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: tab === k ? colors.yellow : theme.surface, borderWidth: 1, borderColor: tab === k ? colors.yellow : theme.border }}>
            <T size={14} weight="extrabold" color={tab === k ? colors.ink : theme.text}>{label}</T>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={{ padding: 14, paddingTop: 0, paddingBottom: insets.bottom + 24, gap: 14 }} refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.yellow} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        {error ? <Card style={{ borderColor: colors.red }}><T color="#ff8a80">{error}</T></Card> : null}
        {tab === 'jobs' ? (
          <>
            {jobs.map((j) => {
              const a = j.address_snapshot ?? {};
              const detail = [a.entrance && `სადარბაზო ${a.entrance}`, a.floor && `სართული ${a.floor}`, a.apartment && `ბინა ${a.apartment}`].filter(Boolean).join(' · ');
              const cash = j.payment_method === 'cash';
              return (
                <Card key={j.id}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <T size={20} weight="extrabold">№{j.number}</T>
                    <T size={13} color={theme.muted}>აიღე: {j.branch_name}</T>
                  </View>
                  <View style={{ gap: 4 }}>
                    <T size={19} weight="extrabold">{a.street ?? '—'}</T>
                    {detail ? <T size={15} color={theme.muted}>{detail}</T> : null}
                    {a.comment ? <T size={14} color={colors.yellow}>💬 {a.comment}</T> : null}
                  </View>
                  <View style={{ borderRadius: 14, padding: 12, backgroundColor: cash ? colors.yellow : '#173D2A', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <T size={15} weight="extrabold" color={cash ? colors.ink : '#7be0a5'}>{cash ? 'აიღე ნაღდი ფული' : 'გადახდილია ბარათით'}</T>
                    {cash ? <T size={22} weight="extrabold" color={colors.ink}>{gel(j.total_tetri)}</T> : null}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Btn title="დარეკვა" icon="phone" kind="ghost" disabled={!j.phone} onPress={() => j.phone && Linking.openURL(`tel:${j.phone}`)} style={{ flex: 1 }} />
                    <Btn title="რუკა" icon="map" kind="ghost" onPress={() => Linking.openURL(Platform.OS === 'ios' ? `http://maps.apple.com/?q=${encodeURIComponent((a.street ?? '') + ', თბილისი')}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((a.street ?? '') + ', Georgia')}`)} style={{ flex: 1 }} />
                  </View>
                  {j.full_name ? <T size={13} color={theme.muted}>{j.full_name}{j.phone ? ` · ${j.phone}` : ''}</T> : null}
                  {confirm === j.id ? (
                    <View style={{ gap: 8 }}>
                      <T size={15} weight="semibold" style={{ textAlign: 'center' }}>დარწმუნებული ხარ, რომ მიტანილია?</T>
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <Btn title="არა" kind="ghost" onPress={() => setConfirm(null)} style={{ flex: 1 }} />
                        <Btn title="დიახ, მიტანილია" kind="green" icon="check" busy={busyId === j.id} onPress={() => deliver(j)} style={{ flex: 2 }} />
                      </View>
                    </View>
                  ) : <Btn title="მიტანილია" icon="check" onPress={() => setConfirm(j.id)} />}
                </Card>
              );
            })}
            {jobs.length === 0 && !error ? (
              <View style={{ alignItems: 'center', gap: 10, paddingTop: 60 }}>
                <Icon name="box" size={44} color={theme.muted} />
                <T size={16} weight="semibold" color={theme.muted}>ახლა გასატანი შეკვეთა არ არის</T>
                <T size={13} color={theme.muted}>ახალი შეკვეთა თავისით გამოჩნდება</T>
              </View>
            ) : null}
          </>
        ) : (
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
