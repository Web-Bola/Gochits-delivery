import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel, sortBranchOptions, type BranchOption } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Icon } from '../src/components/Icon';
import { TabBar } from '../src/components/TabBar';
import { Bump, Shimmer, SlideUp } from '../src/components/fx';
import { Button, FadeIn, StateView } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { MerchantLogo } from '../src/components/MerchantLogo';
import { KIND_ICON, KIND_LABEL, KIND_ONE, hasBundledArt, initial, loadMerchants, type Merchant } from '../src/lib/merchants';
import { useCart } from '../src/state/cart';

const TINTS = ['#1E3A5F', '#2B3F6B', '#1F4B57', '#33406B', '#2A4A6A'];
const tintOf = (name: string) => TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length]!;

function Cover({ m, height }: { m: Merchant; height: number }) {
  if (hasBundledArt(m)) return <Image source={require('../assets/cover.jpg')} style={{ width: '100%', height }} resizeMode="cover" />;
  return (
    <View style={{ width: '100%', height, backgroundColor: tintOf(m.name), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: height * 0.55, color: 'rgba(255,255,255,0.14)' }}>{initial(m.name)}</Text>
    </View>
  );
}

type Opt = BranchOption & { merchant_id?: string };
interface BranchRow { id: string; name: string; address: string | null; accepts_orders: boolean; is_open: boolean; pickup_enabled: boolean; lat: number | null; lng: number | null; merchant_id: string }
type Pos = { lat: number; lng: number };

const km = (a: Pos, b: Pos) => {
  const R = 6371, rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

async function currentPosition(): Promise<Pos> {
  const p = await Promise.race([Location.getCurrentPositionAsync({}), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000))]);
  return { lat: p.coords.latitude, lng: p.coords.longitude };
}

const TINT: Record<string, string> = { all: '#1A2E44', restaurant: '#3A2E3C', cafe: '#3B3426', grocery: '#1F3B35', pharmacy: '#22384D', flowers: '#3B2A38', other: '#2B3345' };

export default function Home() {
  const router = useRouter();
  const { count, subtotal, branch, setBranch, address } = useCart();
  const [list, setList] = useState<Merchant[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string>('all');
  const [mode, setMode] = useState<'delivery' | 'pickup'>('delivery');
  const [gps, setGps] = useState<Pos | null>(null);
  const [loc, setLoc] = useState<'checking' | 'need' | 'denied' | 'busy' | 'ready'>('checking');
  const [options, setOptions] = useState<Opt[] | null>(null);
  const [brs, setBrs] = useState<BranchRow[] | null>(null);
  const [pending, setPending] = useState<{ m: Merchant; id: string; name: string } | null>(null);

  // where we deliver to: the saved address wins, otherwise the phone's position
  const pos: Pos | null = address ? { lat: address.lat, lng: address.lng } : gps;

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setList(await loadMerchants());
      const { data } = await supabase.rpc('list_branches');
      setBrs((data ?? []) as BranchRow[]);
    } catch (e) { console.warn('merchants load failed', e); setFailed(true); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { loadMerchants().then(setList).catch(() => undefined); }, []));

  const askLocation = useCallback(async () => {
    setLoc('busy');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setLoc('denied'); return; }
      setGps(await currentPosition()); setLoc('ready');
    } catch (e) { console.warn('location failed', e); setLoc('need'); }
  }, []);

  // silent check on start: only read the position when permission was already given
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!alive) return;
        if (perm.status === 'granted') { const p = await currentPosition(); if (alive) { setGps(p); setLoc('ready'); } } else setLoc(perm.canAskAgain === false ? 'denied' : 'need');
      } catch { if (alive) setLoc('need'); }
    })();
    return () => { alive = false; };
  }, []);

  // which branches really serve this point: decided by delivery zones on the server, never by distance alone
  const posKey = pos ? `${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}` : '';
  useEffect(() => {
    if (!pos) { setOptions(null); return; }
    let alive = true;
    supabase.rpc('resolve_branches', { p_lat: pos.lat, p_lng: pos.lng }).then(({ data, error }) => {
      if (!alive) return;
      if (error) { console.warn('resolve_branches failed', error); setOptions([]); return; }
      setOptions((data ?? []) as Opt[]);
    });
    return () => { alive = false; };
  }, [posKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const eligible = useCallback((m: Merchant) => (mode === 'delivery'
    ? (options ?? []).some((o) => o.merchant_id === m.id)
    : (brs ?? []).some((b) => b.merchant_id === m.id && b.pickup_enabled)), [mode, options, brs]);
  const openNow = useCallback((m: Merchant) => (mode === 'delivery'
    ? (options ?? []).some((o) => o.merchant_id === m.id && o.can_order)
    : (brs ?? []).some((b) => b.merchant_id === m.id && b.pickup_enabled && b.accepts_orders && b.is_open)), [mode, options, brs]);
  const feeOf = (m: Merchant): number | null => {
    const f = (options ?? []).filter((o) => o.merchant_id === m.id && o.fee_tetri != null).map((o) => o.fee_tetri as number);
    return f.length ? Math.min(...f) : null;
  };

  const kinds = useMemo(() => [...new Set((list ?? []).filter(eligible).map((m) => m.kind))], [list, eligible]);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => (list ?? []).filter((m) => eligible(m) && (kind === 'all' || m.kind === kind) && (!needle || m.name.toLowerCase().includes(needle) || (m.description ?? '').toLowerCase().includes(needle))), [list, kind, needle, eligible]);
  const live = shown.filter(openNow);
  const later = shown.filter((m) => !openNow(m));

  /** Picks the branch automatically: delivery = orderable branch of this business that covers the address, pickup = nearest pickup branch. */
  const openMerchant = (m: Merchant) => {
    let pick: { id: string; name: string } | null = null;
    if (mode === 'delivery') {
      const mine = sortBranchOptions((options ?? []).filter((o) => o.merchant_id === m.id));
      if (mine[0]) pick = { id: mine[0].branch_id, name: mine[0].branch_name };
    } else {
      const mine = (brs ?? []).filter((b) => b.merchant_id === m.id && b.pickup_enabled).sort((a, b) => {
        if ((a.accepts_orders && a.is_open) !== (b.accepts_orders && b.is_open)) return a.accepts_orders && a.is_open ? -1 : 1;
        if (pos && a.lat != null && a.lng != null && b.lat != null && b.lng != null) return km(pos, { lat: a.lat, lng: a.lng }) - km(pos, { lat: b.lat, lng: b.lng });
        return a.name.localeCompare(b.name);
      });
      if (mine[0]) pick = { id: mine[0].id, name: mine[0].name };
    }
    if (!pick) return;
    if (branch && branch.id !== pick.id && count > 0) { setPending({ m, ...pick }); return; }
    enter(m, pick);
  };
  const enter = (m: Merchant, pick: { id: string; name: string }) => {
    setPending(null);
    setBranch({ id: pick.id, name: pick.name, merchantId: m.id, merchantName: m.name });
    router.push('/menu');
  };

  const tile = (id: string, label: string, icon: string) => {
    const on = kind === id;
    return (
      <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setKind(id)}
        style={{ width: 88, alignItems: 'center', gap: 8 }}>
        <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: on ? colors.brand : TINT[id] ?? theme.surface2, alignItems: 'center', justifyContent: 'center', borderWidth: on ? 0 : 1, borderColor: theme.border }}>
          <Icon name={icon} size={28} color={on ? colors.onBrand : theme.text} />
        </View>
        <Text numberOfLines={1} style={{ fontFamily: on ? fontFamily.extrabold : fontFamily.semibold, fontSize: 12.5, color: on ? theme.text : theme.muted }}>{label}</Text>
      </Pressable>
    );
  };

  const card = (m: Merchant, i: number, dim: boolean) => {
    const fee = mode === 'delivery' ? feeOf(m) : null;
    return (
    <FadeIn key={m.id} index={i}>
      <Pressable accessibilityRole="button" accessibilityLabel={m.name} onPress={() => openMerchant(m)} style={{ opacity: dim ? 0.62 : 1 }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: theme.border }}>
          <View>
            <Cover m={m} height={138} />
            <View style={{ position: 'absolute', left: 12, top: 12, flexDirection: 'row', gap: 6 }}>
              <View style={{ backgroundColor: dim ? 'rgba(10,21,34,0.88)' : colors.brand, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 11.5, color: dim ? theme.text : colors.onBrand }}>{dim ? 'ახლა დაკეტილია' : 'ღიაა'}</Text>
              </View>
              {mode === 'pickup' ? (
                <View style={{ backgroundColor: 'rgba(10,21,34,0.88)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon name="bag" size={12} color={theme.text} /><Text style={{ fontFamily: fontFamily.semibold, fontSize: 11.5, color: theme.text }}>თვითონ წამოღება</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={{ padding: 14, paddingTop: 12, gap: 3 }}>
            <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: theme.text }}>{m.name}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fontFamily.regular, fontSize: 13, color: theme.muted }}>{[KIND_ONE[m.kind], m.description].filter(Boolean).join(' · ')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Icon name={mode === 'delivery' ? 'bike' : 'pin'} size={14} color={colors.brand} />
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12.5, color: theme.muted }}>{mode === 'delivery' ? (fee != null ? `მიტანა ${formatGel(fee)}` : 'მიტანა') : 'წამოღება ფილიალიდან'}</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </FadeIn>
    );
  };

  const seg = (id: 'delivery' | 'pickup', label: string, icon: string) => {
    const on = mode === id;
    return (
      <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setMode(id); setKind('all'); }}
        style={{ flex: 1, minHeight: 42, borderRadius: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: on ? colors.brand : 'transparent' }}>
        <Icon name={icon} size={18} color={on ? colors.onBrand : theme.muted} />
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: on ? colors.onBrand : theme.muted }}>{label}</Text>
      </Pressable>
    );
  };

  const needPos = mode === 'delivery' && !pos;
  const loadingList = !list || (mode === 'delivery' && pos && !options) || (mode === 'pickup' && !brs);
  const placeName = address?.street ?? (gps ? 'ჩემი მდებარეობა' : 'მიუთითე მისამართი');

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 200 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Image source={require('../assets/zyro-logo.png')} style={{ width: 92, height: 42 }} resizeMode="contain" accessibilityLabel="ZYRO" />
            <Pressable accessibilityRole="button" accessibilityLabel={ka.menu.viewCart} onPress={() => router.push('/cart')}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}>
              <Icon name="bag" size={22} color={theme.text} />
              {count > 0 ? <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 11, color: colors.onBrand }}>{count}</Text></View> : null}
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="მისამართის შეცვლა" onPress={() => router.push('/address')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%', minHeight: 40 }}>
            <Icon name="pin" size={18} color={colors.brand} />
            <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text, flexShrink: 1 }}>{placeName}</Text>
            <Icon name="chev" size={16} color={theme.muted} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 14, minHeight: 50, borderWidth: 1, borderColor: theme.border }}>
            <Icon name="search" size={20} color={theme.muted} />
            <TextInput accessibilityLabel="ძებნა" placeholder="რას ეძებ?" placeholderTextColor={theme.muted} value={q} onChangeText={setQ}
              style={[{ flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: theme.text, minWidth: 0 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
            {q ? <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={() => setQ('')}><Icon name="x" size={18} color={theme.muted} /></Pressable> : null}
          </View>
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 24, padding: 4, borderWidth: 1, borderColor: theme.border }}>
            {seg('delivery', 'მიტანა', 'bike')}{seg('pickup', 'წამოღება', 'bag')}
          </View>
        </View>

        <View style={{ marginHorizontal: 20, marginTop: 20, borderRadius: 20, backgroundColor: colors.brand, padding: 18, overflow: 'hidden', minHeight: 110, justifyContent: 'center' }}>
          <View style={{ position: 'absolute', right: -24, top: -24, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.18)' }} />
          <View style={{ position: 'absolute', right: 30, bottom: -40, width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(11,23,36,0.10)' }} />
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 22, lineHeight: 28, color: colors.onBrand }}>ყველაფერი,{'\n'}მიტანით</Text>
          <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: colors.onBrand, marginTop: 4 }}>რესტორნები, მაღაზიები და სხვა — ერთ აპში</Text>
        </View>

        {kinds.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {tile('all', 'ყველა', 'home')}
            {kinds.map((k) => tile(k, KIND_LABEL[k] ?? k, KIND_ICON[k] ?? 'store'))}
          </ScrollView>
        ) : null}

        <View style={{ paddingHorizontal: 20, paddingTop: 22, gap: 14 }}>
          {pending ? (
            <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.red }}>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: theme.text }}>{ka.branch.changeWarn}</Text>
              <Button title={ka.branch.changeYes} onPress={() => enter(pending.m, pending)} />
              <Button title={ka.branch.changeNo} variant="outline" onPress={() => setPending(null)} />
            </View>
          ) : null}
          {needPos ? (
            <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: theme.border }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="pin" size={26} color={colors.brand} /></View>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: theme.text }}>სად მოგიტანოთ?</Text>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.muted, lineHeight: 20 }}>
                {loc === 'denied' ? 'მდებარეობაზე წვდომა გამორთულია. მიუთითე მისამართი ხელით, ან გამოიყენე „წამოღება“.' : 'მდებარეობით მხოლოდ იმ ბიზნესებს გაჩვენებ, რომლებიც შენს მისამართზე აწვდიან.'}
              </Text>
              {loc !== 'denied' ? <Button title={loc === 'busy' ? 'ვადგენ…' : 'გამოიყენე ჩემი მდებარეობა'} onPress={askLocation} disabled={loc === 'busy' || loc === 'checking'} /> : null}
              <Button title="მისამართის მითითება" variant="outline" onPress={() => router.push('/address')} />
            </View>
          ) : null}
          {!needPos && loadingList ? [0, 1].map((i) => <Shimmer key={i} style={{ height: 230, borderRadius: 20, backgroundColor: theme.surface }} />) : null}
          {list && failed ? <StateView tone="error" icon="clock" title="ბიზნესები ვერ ჩაიტვირთა" hint={ka.errors.network} actionTitle={ka.common.retry} onAction={load} /> : null}
          {!needPos && !loadingList && !failed && shown.length === 0 ? (
            <StateView icon="pin" title={mode === 'delivery' && !needle && kind === 'all' ? 'ამ მისამართზე ჯერ არავინ აწვდის' : 'ვერაფერი მოიძებნა'}
              hint={mode === 'delivery' && !needle && kind === 'all' ? 'სცადე სხვა მისამართი ან აირჩიე „წამოღება“' : 'სცადე სხვა სიტყვა ან კატეგორია'}
              actionTitle={mode === 'delivery' && !needle && kind === 'all' ? 'წამოღების რეჟიმი' : undefined} onAction={mode === 'delivery' && !needle && kind === 'all' ? () => setMode('pickup') : undefined} />
          ) : null}
          {live.length > 0 ? <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text }}>{mode === 'delivery' ? 'მიგიტანენ შენთან' : 'ახლა მუშაობს'}</Text> : null}
          {live.map((m, i) => card(m, i, false))}
          {later.length > 0 ? <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text, marginTop: 6 }}>ამჟამად დაკეტილია</Text> : null}
          {later.map((m, i) => card(m, i + live.length, true))}
        </View>
      </ScrollView>

      {count > 0 && (
        <SlideUp style={{ position: 'absolute', left: 16, right: 16, bottom: 70 }}>
          <Bump value={count}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/cart')}
              style={{ minHeight: 54, borderRadius: 27, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }}>
              <View style={{ minWidth: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(11,23,36,0.18)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.onBrand }}>{count}</Text></View>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.onBrand }}>{ka.menu.viewCart}</Text>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.onBrand }}>{formatGel(subtotal)}</Text>
            </Pressable>
          </Bump>
        </SlideUp>
      )}
      <TabBar />
    </View>
  );
}
