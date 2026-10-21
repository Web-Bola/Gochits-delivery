import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { merchantArt } from '../src/lib/art';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel, productQuantity } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, CtaBar, StateView } from '../src/components/ui';
import { Icon, categoryIcon } from '../src/components/Icon';
import { Bump, Shimmer, SlideUp } from '../src/components/fx';
import { DealsRow } from '../src/components/Banners';
import { ProductRow, Scrim } from '../src/components/product';
import { discountPercent, isSpicy, loadMenu, type Menu, type Product } from '../src/lib/menuData';
import { photoOf } from '../src/components/product';
import { hasBundledArt, initial, loadMerchants, type Merchant } from '../src/lib/merchants';
import { MerchantLogo } from '../src/components/MerchantLogo';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

type Filter = 'deals' | 'spicy' | 'price' | null;
interface BranchState { is_open: boolean; accepts_orders: boolean; address: string | null; merchant_id?: string }

export default function MenuScreen() {
  const router = useRouter();
  const { ready, branch, lines, add, count, subtotal } = useCart();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<BranchState | null>(null);
  const [mer, setMer] = useState<Merchant | null>(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>(null);
  const [active, setActive] = useState<string>('');
  const [bumps, setBumps] = useState<Record<string, number>>({});

  const scroller = useRef<ScrollView>(null);
  const tabsH = useRef(52);
  const secY = useRef<Record<string, number>>({});
  const contentY = useRef(0);
  const tabX = useRef<Record<string, number>>({});
  const tabStrip = useRef<ScrollView>(null);
  const lock = useRef(0);

  const load = useCallback(async () => {
    if (!branch) return;
    setFailed(false); setMenu(null);
    try {
      setMenu(await loadMenu(branch.id));
      const { data } = await supabase.rpc('list_branches');
      const me = ((data ?? []) as { id: string; is_open: boolean; accepts_orders: boolean; address: string | null; merchant_id: string }[]).find((b) => b.id === branch.id);
      setState(me ? { is_open: me.is_open, accepts_orders: me.accepts_orders, address: me.address, merchant_id: me.merchant_id } : null);
      const ms = await loadMerchants().catch(() => [] as Merchant[]);
      setMer(ms.find((m) => m.id === (branch.merchantId ?? me?.merchant_id)) ?? null);
    } catch (e) { console.warn('menu load failed', e); setFailed(true); }
  }, [branch]);

  useEffect(() => {
    if (!ready) return;
    if (!branch) { router.replace('/home'); return; }
    load();
  }, [ready, branch, load, router]);

  // open/closed can change while the screen stays mounted (hours edited, time passes): re-check every time we come back
  useFocusEffect(useCallback(() => {
    if (!branch) return;
    let alive = true;
    supabase.rpc('list_branches').then(({ data }) => {
      if (!alive) return;
      const me = ((data ?? []) as { id: string; is_open: boolean; accepts_orders: boolean; address: string | null }[]).find((b) => b.id === branch.id);
      if (me) setState({ is_open: me.is_open, accepts_orders: me.accepts_orders, address: me.address });
    });
    return () => { alive = false; };
  }, [branch]));

  const shown = useMemo(() => (menu?.categories ?? []).map((c) => ({ cat: c, list: (menu?.products ?? []).filter((p) => p.category_id === c.id) })).filter((x) => x.list.length > 0), [menu]);
  const deals = useMemo(() => (menu?.products ?? []).filter((p) => p.available && discountPercent(p) && photoOf(p.image_path)).slice(0, 6), [menu]);
  const needle = q.trim().toLowerCase();
  const flat = needle.length > 0 || filter !== null;
  const results = useMemo(() => {
    let r = (menu?.products ?? []).filter((p) => (needle ? p.name.toLowerCase().includes(needle) : true));
    if (filter === 'deals') r = r.filter((p) => discountPercent(p));
    if (filter === 'spicy') r = r.filter(isSpicy);
    if (filter === 'price') r = [...r].sort((a, b) => a.price_tetri - b.price_tetri);
    return r;
  }, [menu, needle, filter]);

  useEffect(() => { if (!active && shown[0]) setActive(shown[0].cat.id); }, [shown, active]);
  useEffect(() => { if (!flat && shown[0]) setActive(shown[0].cat.id); }, [flat]); // eslint-disable-line react-hooks/exhaustive-deps

  const addItem = (p: Product) => {
    if (!p.available) return;
    add({ productId: p.id, name: p.name, unitPriceTetri: p.price_tetri });
    setBumps((b) => ({ ...b, [p.id]: (b[p.id] ?? 0) + 1 }));
  };
  const open = (p: Product) => router.push({ pathname: '/product/[id]', params: { id: p.id } });

  const goTo = (id: string) => {
    if (flat) { setQ(''); setFilter(null); }
    setActive(id);
    lock.current = Date.now() + 700;
    const y = secY.current[id];
    if (y !== undefined) scroller.current?.scrollTo({ y: Math.max(0, contentY.current + y - tabsH.current), animated: true });
    const x = tabX.current[id];
    if (x !== undefined) tabStrip.current?.scrollTo({ x: Math.max(0, x - 20), animated: true });
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (flat || Date.now() < lock.current) return;
    const y = e.nativeEvent.contentOffset.y + tabsH.current + 12;
    let cur = shown[0]?.cat.id ?? '';
    for (const { cat } of shown) { const sy = secY.current[cat.id]; if (sy !== undefined && contentY.current + sy <= y) cur = cat.id; }
    if (cur !== active) { setActive(cur); const x = tabX.current[cur]; if (x !== undefined) tabStrip.current?.scrollTo({ x: Math.max(0, x - 20), animated: true }); }
  };

  const act = useRef({ addItem, open });
  act.current = { addItem, open };
  const onAddStable = useCallback((p: Product) => act.current.addItem(p), []);
  const onOpenStable = useCallback((p: Product) => act.current.open(p), []);
  const rows = (list: Product[]) => (
    <View style={{ paddingHorizontal: 20 }}>
      {list.map((it) => (
        <ProductRow key={it.id} item={it} qty={productQuantity(lines, it.id)} bumped={bumps[it.id] ?? 0}
          onAdd={onAddStable} onOpen={onOpenStable} />
      ))}
    </View>
  );

  const chip = (id: Exclude<Filter, null>, label: string) => {
    const on = filter === id;
    return (
      <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFilter(on ? null : id)}
        style={{ height: 38, paddingHorizontal: 16, borderRadius: 19, justifyContent: 'center', backgroundColor: on ? colors.brand : theme.surface, borderWidth: on ? 0 : 1, borderColor: theme.border }}>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: on ? colors.onBrand : theme.muted }}>{label}</Text>
      </Pressable>
    );
  };

  const pill = (text: string, node?: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: theme.surface, alignSelf: 'flex-start', maxWidth: '100%' }}>
      {node}<Text numberOfLines={1} style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: theme.text, flexShrink: 1 }}>{text}</Text>
    </View>
  );

  const openNow = state ? state.accepts_orders && state.is_open : null;
  const statusText = openNow ? ka.branch.open : '';

  const [filtersOpen, setFiltersOpen] = useState(false);
  /** Venue top: cover fading into the page, logo + name + status, search with filter button. */
  const header = (
    <View>
      <View style={{ height: 210, backgroundColor: theme.surface }}>
        <View style={{ flex: 1, overflow: 'hidden', backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' }}>
          {mer && merchantArt(mer.slug) ? <Image source={merchantArt(mer.slug)!.cover} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
            : mer && !hasBundledArt(mer) ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 120, color: 'rgba(255,255,255,0.12)' }}>{initial(mer.name)}</Text>
            : <Image source={require('../assets/cover.jpg')} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />}
          <Scrim side="top" height={70} max={0.4} />
          <Scrim side="bottom" height={130} max={1} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="უკან" onPress={() => router.replace('/home')}
          style={{ position: 'absolute', left: 16, top: 16, width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(249,248,245,0.7)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="back" size={22} color={theme.text} />
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 16, paddingBottom: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 14, marginTop: -52 }}>
          <MerchantLogo m={{ slug: mer?.slug ?? 'gochits', name: mer?.name ?? branch?.merchantName ?? "Gochit's" }} size={84} />
          <View style={{ flex: 1, paddingBottom: 4, gap: 3 }}>
            <Text accessibilityRole="header" numberOfLines={2} style={{ fontFamily: fontFamily.extrabold, fontSize: 24, color: theme.text, lineHeight: 29 }}>{mer ? (mer.slug === 'gochits' ? "Gochit's" : mer.name) : (branch?.merchantName ?? '')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: openNow ? colors.success : colors.red }} />
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: fontFamily.semibold, fontSize: 13, color: theme.muted }}>{openNow ? ka.branch.open : ka.branch.closedNow}{branch?.name ? ` · ${branch.name}` : ''}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 25, paddingLeft: 16, paddingRight: 6, minHeight: 50, borderWidth: 1, borderColor: 'rgba(11,167,154,0.14)' }}>
          <Icon name="search" size={20} color={theme.muted} />
          <TextInput accessibilityLabel={ka.menu.search} placeholder="რას ეძებთ?" placeholderTextColor={theme.muted} value={q} onChangeText={setQ}
            style={[{ flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: theme.text, minWidth: 0 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
          {q ? <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={() => setQ('')}><Icon name="x" size={18} color={theme.muted} /></Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="ფილტრი" onPress={() => setFiltersOpen((v) => !v)}
            style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: filtersOpen || filter ? colors.brand : 'rgba(11,167,154,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="filter" size={20} color={filtersOpen || filter ? colors.onBrand : colors.brand} />
          </Pressable>
        </View>
        {filtersOpen || filter ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
            {chip('deals', ka.menu.discounts)}{chip('spicy', ka.menu.spicy)}{chip('price', ka.menu.priceAsc)}
          </ScrollView>
        ) : null}
        {menu?.products.some((p) => p.price_source === 'unapproved') ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 11, color: theme.muted }}>{ka.menu.unapprovedPrices}</Text> : null}
      </View>
    </View>
  );

  if (!ready || (!menu && !failed)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={{ height: 190, backgroundColor: theme.surface }} />
        <View style={{ padding: 20, paddingTop: 50, gap: 14 }}>
          {[0, 1, 2, 3].map((i) => <View key={i} style={{ flexDirection: 'row', gap: 14 }}><View style={{ flex: 1, gap: 10, paddingTop: 6 }}><Shimmer style={{ height: 14, borderRadius: 7, backgroundColor: theme.surface2 }} /><Shimmer style={{ height: 12, width: '60%', borderRadius: 6, backgroundColor: theme.surface2 }} /></View><Shimmer style={{ width: 104, height: 104, borderRadius: 14, backgroundColor: theme.surface2 }} /></View>)}
        </View>
      </View>
    );
  }
  if (failed || !menu) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {header}
        <View style={{ padding: 20 }}><StateView tone="error" icon="clock" title={ka.menu.loadFail} hint={ka.errors.network} actionTitle={ka.common.retry} onAction={load} /></View>
      </View>
    );
  }

  const mains = shown;
  const resultsTitle = needle ? ka.menu.search : filter === 'deals' ? ka.menu.discounts : filter === 'spicy' ? ka.menu.spicy : ka.menu.priceAsc;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView ref={scroller} stickyHeaderIndices={[2]} onScroll={onScroll} scrollEventThrottle={32} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {header}

        <View style={{ gap: 14, paddingBottom: 6 }}>
          {!flat && deals.length > 0 ? (
            <View style={{ gap: 10, paddingTop: 4 }}>
              <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text, paddingHorizontal: 20 }}>{ka.menu.dealsTitle}</Text>
              <DealsRow items={deals} qtyOf={(id) => productQuantity(lines, id)} onAdd={addItem} onOpen={open} />
            </View>
          ) : null}
        </View>

        <View onLayout={(e: LayoutChangeEvent) => { tabsH.current = e.nativeEvent.layout.height; }} style={{ backgroundColor: theme.bg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          {!flat ? (
            <ScrollView ref={tabStrip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
              {mains.map(({ cat }) => {
                const on = active === cat.id;
                return (
                  <Pressable key={cat.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => goTo(cat.id)}
                    onLayout={(e: LayoutChangeEvent) => { tabX.current[cat.id] = e.nativeEvent.layout.x; }}
                    style={{ height: 54, marginVertical: 8, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 18, backgroundColor: on ? colors.brand : theme.surface, borderWidth: on ? 0 : 1, borderColor: 'rgba(11,167,154,0.14)', ...(on ? { shadowColor: colors.brand, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 3 } } : {}) }}>
                    <Icon name={categoryIcon(cat.name_ka)} size={22} color={on ? colors.onBrand : colors.brand} />
                    <Text style={{ fontFamily: on ? fontFamily.extrabold : fontFamily.semibold, fontSize: 13.5, color: on ? colors.onBrand : theme.text }}>{cat.name_ka}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : <View style={{ height: 1 }} />}
        </View>

        {flat ? (
          <View style={{ gap: 4, paddingTop: 18 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text, paddingHorizontal: 20 }}>{resultsTitle}</Text>
            {results.length > 0 ? rows(results) : <View style={{ alignItems: 'center', gap: 8, padding: 30 }}><Icon name="search" size={40} color={theme.muted} /><Body muted>{ka.menu.nothing}</Body></View>}
          </View>
        ) : (
          <View onLayout={(e: LayoutChangeEvent) => { contentY.current = e.nativeEvent.layout.y; }} style={{ gap: 6, paddingTop: 6 }}>
            {mains.map(({ cat, list }) => (
              <View key={cat.id} onLayout={(e: LayoutChangeEvent) => { secY.current[cat.id] = e.nativeEvent.layout.y; }} style={{ paddingTop: 14 }}>
                <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text, paddingHorizontal: 20 }}>{cat.name_ka}</Text>
                {rows(list)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {count > 0 && (
        <SlideUp style={{ position: 'absolute', left: 16, right: 16, bottom: 20 }}>
          <Bump value={count}>
            <CtaBar icon="bag" title={ka.menu.viewCart} price={formatGel(subtotal)} divider onPress={() => router.push('/cart')} />
          </Bump>
        </SlideUp>
      )}
    </View>
  );
}
