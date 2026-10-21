import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel, sortBranchOptions, type BranchOption } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '../src/components/Icon';
import { TabBar } from '../src/components/TabBar';
import { Bump, Shimmer, SlideUp } from '../src/components/fx';
import { merchantArt } from '../src/lib/art';
import { Button, FadeIn, StateView } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { MerchantLogo } from '../src/components/MerchantLogo';
import { KIND_ICON, KIND_LABEL, KIND_ONE, hasBundledArt, initial, loadMerchants, type Merchant } from '../src/lib/merchants';
import { useCart } from '../src/state/cart';

const TINTS = ['#1E3A5F', '#2B3F6B', '#1F4B57', '#33406B', '#2A4A6A'];
const tintOf = (name: string) => TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length]!;

function Cover({ m, height }: { m: Merchant; height: number }) {
  const art = merchantArt(m.slug);
  if (art) return <Image source={art.card} style={{ width: '100%', height }} resizeMode="cover" />;
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

const CATS: { id: string; label: string; icon: string; re: RegExp | null }[] = [
  { id: 'all', label: 'ყველაფერი', icon: 'store', re: null },
  { id: 'cafe', label: 'კაფეები', icon: 'ccup', re: /cafe|კაფე|coffee|ყავა/i },
  { id: 'burger', label: 'ბურგერები', icon: 'cburger', re: /burger|ბურგერ/i },
  { id: 'pizza', label: 'პიცა', icon: 'cwrap', re: /pizza|პიც/i },
  { id: 'asian', label: 'აზიური', icon: 'cbowl', re: /sushi|asian|სუში|აზიურ|ვოკ|wok|ramen|რამენ/i },
  { id: 'other', label: 'სხვა', icon: 'ccombo', re: null },
];
const catHit = (m: Merchant, id: string) => {
  const hay = `${m.name} ${m.description ?? ''} ${m.slug ?? ''} ${m.kind}`;
  if (id === 'all') return true;
  if (id === 'other') return !CATS.some((c) => c.re && c.id !== 'other' && c.re.test(hay));
  return !!CATS.find((c) => c.id === id)?.re?.test(hay);
};

const TINT: Record<string, string> = { all: '#1C1630', restaurant: '#3A2E3C', cafe: '#3B3426', grocery: '#1F3B35', pharmacy: '#22384D', flowers: '#3B2A38', other: '#2B3345' };

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

  const [filterOpen, setFilterOpen] = useState(false);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => (list ?? []).filter((m) => eligible(m) && catHit(m, kind) && (!needle || m.name.toLowerCase().includes(needle) || (m.description ?? '').toLowerCase().includes(needle))), [list, kind, needle, eligible]);
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

  const chip = (id: string, label: string, icon: string) => {
    const on = kind === id;
    return (
      <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setKind(id)}>
        {on ? (
          <LinearGradient colors={['#B79CFF', '#8B5CF6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 42, borderRadius: 21, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name={icon} size={18} color={colors.onBrand} />
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13.5, color: colors.onBrand }}>{label}</Text>
          </LinearGradient>
        ) : (
          <View style={{ height: 42, borderRadius: 21, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }}>
            <Icon name={icon} size={18} color={theme.muted} />
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13.5, color: theme.muted }}>{label}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  const etaOf = (m: Merchant): number | null => {
    const e = (options ?? []).filter((o) => o.merchant_id === m.id && o.can_order).map((o) => o.extra_minutes as number);
    return e.length ? 25 + Math.min(...e) : null;
  };
  const card = (m: Merchant, i: number, dim: boolean) => {
    const fee = mode === 'delivery' ? feeOf(m) : null;
    const eta = mode === 'delivery' ? etaOf(m) : null;
    const meta = (icon: string, text: string) => (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name={icon} size={14} color={colors.brand} /><Text style={{ fontFamily: fontFamily.semibold, fontSize: 12.5, color: theme.text }}>{text}</Text></View>
    );
    return (
    <FadeIn key={m.id} index={i}>
      <Pressable accessibilityRole="button" accessibilityLabel={m.name} onPress={() => openMerchant(m)} style={{ opacity: dim ? 0.6 : 1 }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(139,92,246,0.14)' }}>
          <View>
            <Cover m={m} height={172} />
            <LinearGradient colors={['transparent', 'rgba(10,8,20,0.85)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 90 }} pointerEvents="none" />
            {dim ? <View style={{ position: 'absolute', left: 12, top: 12, backgroundColor: 'rgba(10,8,20,0.8)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.red }}>დაკეტილია</Text></View> : null}
            <View style={{ position: 'absolute', left: 12, bottom: -22, borderRadius: 16, borderWidth: 2, borderColor: theme.surface, overflow: 'hidden' }}><MerchantLogo m={m} size={52} /></View>
          </View>
          <View style={{ paddingTop: 28, paddingHorizontal: 14, paddingBottom: 14, gap: 3 }}>
            <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{m.name}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fontFamily.regular, fontSize: 12.5, color: theme.muted }}>{[KIND_ONE[m.kind], m.description].filter(Boolean).join(' · ')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
              {mode === 'delivery' ? (
                <>
                  {eta != null ? meta('clock', `~${eta} წთ`) : null}
                  {meta('bike', fee != null ? formatGel(fee) : 'მიტანა')}
                </>
              ) : meta('bag', 'წამოღება')}
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
            <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable accessibilityRole="button" accessibilityLabel={ka.tabs.profile} onPress={() => router.push('/profile')}
              style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="user" size={24} color={theme.text} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={ka.menu.viewCart} onPress={() => router.push('/cart')}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.border }}>
              <Icon name="bag" size={22} color={theme.text} />
              {count > 0 ? <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 11, color: colors.onBrand }}>{count}</Text></View> : null}
            </Pressable>
            </View>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="მისამართის შეცვლა" onPress={() => router.push('/address')}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%', minHeight: 40 }}>
            <Icon name="pin" size={18} color={colors.brand} />
            <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text, flexShrink: 1 }}>{placeName}</Text>
            <Icon name="chev" size={16} color={theme.muted} />
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 25, paddingLeft: 16, paddingRight: 6, minHeight: 50, borderWidth: 1, borderColor: 'rgba(139,92,246,0.14)' }}>
            <Icon name="search" size={20} color={theme.muted} />
            <TextInput accessibilityLabel="ძებნა" placeholder="რესტორანი, კერძი ან სამზარეულო…" placeholderTextColor={theme.muted} value={q} onChangeText={setQ}
              style={[{ flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: theme.text, minWidth: 0 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
            {q ? <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={() => setQ('')}><Icon name="x" size={18} color={theme.muted} /></Pressable> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="ფილტრი" onPress={() => setFilterOpen((v) => !v)}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: filterOpen || mode === 'pickup' ? colors.brand : 'rgba(139,92,246,0.14)', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="filter" size={20} color={filterOpen || mode === 'pickup' ? colors.onBrand : colors.brand} />
            </Pressable>
          </View>
          {filterOpen ? (
            <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 24, padding: 4, borderWidth: 1, borderColor: theme.border }}>
              {seg('delivery', 'მიტანა', 'bike')}{seg('pickup', 'წამოღება', 'bag')}
            </View>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {CATS.map((c) => chip(c.id, c.label, c.icon))}
        </ScrollView>

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
          {!needPos && loadingList ? [0, 1].map((i) => <Shimmer key={i} style={{ height: 250, borderRadius: 24, backgroundColor: theme.surface }} />) : null}
          {list && failed ? <StateView tone="error" icon="clock" title="ბიზნესები ვერ ჩაიტვირთა" hint={ka.errors.network} actionTitle={ka.common.retry} onAction={load} /> : null}
          {!needPos && !loadingList && !failed && shown.length === 0 ? (
            <StateView icon="pin" title={mode === 'delivery' && !needle && kind === 'all' ? 'ამ მისამართზე ჯერ არავინ აწვდის' : 'ვერაფერი მოიძებნა'}
              hint={mode === 'delivery' && !needle && kind === 'all' ? 'სცადე სხვა მისამართი ან აირჩიე „წამოღება“' : 'სცადე სხვა სიტყვა ან კატეგორია'}
              actionTitle={mode === 'delivery' && !needle && kind === 'all' ? 'წამოღების რეჟიმი' : undefined} onAction={mode === 'delivery' && !needle && kind === 'all' ? () => setMode('pickup') : undefined} />
          ) : null}
          {live.length > 0 ? <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text }}>ახლომაბლო ობიექტები</Text> : null}
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
