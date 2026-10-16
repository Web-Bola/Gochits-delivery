import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel, productQuantity } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button } from '../src/components/ui';
import { Icon, categoryIcon } from '../src/components/Icon';
import { TabBar } from '../src/components/TabBar';
import { Bump, Shimmer, SlideUp } from '../src/components/fx';
import { DealsRow, PromoBanner } from '../src/components/Banners';
import { ProductRow, Scrim } from '../src/components/product';
import { discountPercent, isSpicy, loadMenu, type Menu, type Product } from '../src/lib/menuData';
import { photoOf } from '../src/components/product';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

type Filter = 'deals' | 'spicy' | 'price' | null;
interface BranchState { is_open: boolean; accepts_orders: boolean; address: string | null }

export default function MenuScreen() {
  const router = useRouter();
  const { ready, branch, lines, add, count, subtotal } = useCart();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [failed, setFailed] = useState(false);
  const [state, setState] = useState<BranchState | null>(null);
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
      const me = ((data ?? []) as { id: string; is_open: boolean; accepts_orders: boolean; address: string | null }[]).find((b) => b.id === branch.id);
      setState(me ? { is_open: me.is_open, accepts_orders: me.accepts_orders, address: me.address } : null);
    } catch (e) { console.warn('menu load failed', e); setFailed(true); }
  }, [branch]);

  useEffect(() => {
    if (!ready) return;
    if (!branch) { router.replace('/branches'); return; }
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
        style={{ height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: on ? colors.yellow : theme.surface }}>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: on ? colors.ink : theme.muted }}>{label}</Text>
      </Pressable>
    );
  };

  const pill = (text: string, node?: React.ReactNode) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: theme.surface, alignSelf: 'flex-start', maxWidth: '100%' }}>
      {node}<Text numberOfLines={1} style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: theme.text, flexShrink: 1 }}>{text}</Text>
    </View>
  );

  const openNow = state ? state.accepts_orders && state.is_open : null;
  const statusText = state ? (state.accepts_orders ? (state.is_open ? ka.branch.open : ka.branch.closedNow) : ka.branch.notAccepting) : '';

  /** Cover photo, round logo, name, branch pill (tap to change), search and filter chips: the "venue page" top of the demo. */
  const header = (
    <View>
      <View style={{ height: 190, backgroundColor: theme.surface }}>
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <Image source={require('../assets/cover.jpg')} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
          <Scrim side="top" height={70} max={0.35} />
          <Scrim side="bottom" height={110} max={0.8} />
        </View>
        <View style={{ position: 'absolute', left: 20, bottom: -30, width: 76, height: 76, borderRadius: 38, backgroundColor: colors.yellow, borderWidth: 4, borderColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
          <Image source={require('../assets/logo.png')} style={{ width: 56, height: 40 }} resizeMode="contain" accessibilityLabel="Gochit's" />
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 42, paddingBottom: 12, gap: 10 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 25, color: theme.text, lineHeight: 31 }}>Gochit's • გოჩიტ'ს</Text>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: 13, color: theme.muted, marginTop: -6 }}>{ka.menu.tagline}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={ka.branch.change} onPress={() => router.push('/branches')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40, paddingHorizontal: 12, borderRadius: 20, backgroundColor: theme.surface, alignSelf: 'flex-start', maxWidth: '100%' }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: openNow === null ? theme.muted : openNow ? '#3DDC84' : colors.red }} />
          <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: theme.text, flexShrink: 1 }}>{branch?.name}</Text>
          {statusText ? <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12, color: openNow ? '#3DDC84' : colors.red }}>· {statusText}</Text> : null}
          <Text style={{ color: colors.yellow, fontSize: 13 }}>▾</Text>
        </Pressable>
        {state?.address ? pill(state.address, <Icon name="pin" size={16} color={colors.yellow} />) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 14, paddingHorizontal: 14, minHeight: 46 }}>
          <Icon name="search" size={20} color={theme.muted} />
          <TextInput accessibilityLabel={ka.menu.search} placeholder={ka.menu.search} placeholderTextColor={theme.muted} value={q} onChangeText={setQ}
            style={[{ flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: theme.text, minWidth: 0 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
          {q ? <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={() => setQ('')}><Icon name="x" size={18} color={theme.muted} /></Pressable> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
          {chip('deals', ka.menu.discounts)}{chip('spicy', ka.menu.spicy)}{chip('price', ka.menu.priceAsc)}
        </ScrollView>
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
        <TabBar />
      </View>
    );
  }
  if (failed || !menu) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {header}
        <View style={{ padding: 30, alignItems: 'center', gap: 14 }}>
          <Icon name="clock" size={56} color={colors.yellow} />
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{ka.menu.loadFail}</Text>
          <Body muted>{ka.errors.network}</Body>
          <Button title={ka.common.retry} onPress={load} variant="ink" />
        </View>
        <TabBar />
      </View>
    );
  }

  const closed = state !== null && (!state.is_open || !state.accepts_orders);
  const mains = shown;
  const maxOff = Math.max(0, ...menu.products.map((p) => discountPercent(p) ?? 0));
  const resultsTitle = needle ? ka.menu.search : filter === 'deals' ? ka.menu.discounts : filter === 'spicy' ? ka.menu.spicy : ka.menu.priceAsc;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView ref={scroller} stickyHeaderIndices={[2]} onScroll={onScroll} scrollEventThrottle={32} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 190 }}>
        {header}

        <View style={{ gap: 14, paddingBottom: 6 }}>
          {closed ? (
            <View style={{ marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.red }}>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: theme.text }}>{state && !state.accepts_orders ? ka.branch.notAccepting : ka.branch.closedBanner}</Text>
            </View>
          ) : null}
          {!flat && maxOff > 0 ? <PromoBanner maxPercent={maxOff} onPress={() => setFilter('deals')} /> : null}
          {!flat && deals.length > 0 ? (
            <View style={{ gap: 10, paddingTop: 4 }}>
              <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text, paddingHorizontal: 20 }}>{ka.menu.dealsTitle}</Text>
              <DealsRow items={deals} qtyOf={(id) => productQuantity(lines, id)} onAdd={addItem} onOpen={open} />
            </View>
          ) : null}
        </View>

        <View onLayout={(e: LayoutChangeEvent) => { tabsH.current = e.nativeEvent.layout.height; }} style={{ backgroundColor: theme.bg, borderBottomWidth: 1, borderBottomColor: theme.border }}>
          {!flat ? (
            <ScrollView ref={tabStrip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 14 }}>
              {mains.map(({ cat }) => {
                const on = active === cat.id;
                return (
                  <Pressable key={cat.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => goTo(cat.id)}
                    onLayout={(e: LayoutChangeEvent) => { tabX.current[cat.id] = e.nativeEvent.layout.x; }}
                    style={{ minHeight: 48, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 3, borderBottomColor: on ? colors.yellow : 'transparent' }}>
                    <Icon name={categoryIcon(cat.name_ka)} size={17} color={on ? colors.yellow : theme.muted} />
                    <Text style={{ fontFamily: on ? fontFamily.extrabold : fontFamily.semibold, fontSize: 14, color: on ? colors.yellow : theme.muted }}>{cat.name_ka}</Text>
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
        <SlideUp style={{ position: 'absolute', left: 16, right: 16, bottom: 70 }}>
          <Bump value={count}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/cart')}
              style={{ minHeight: 54, borderRadius: 27, backgroundColor: colors.yellow, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } }}>
              <View style={{ minWidth: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(26,13,11,0.15)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.ink }}>{count}</Text></View>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.ink }}>{ka.menu.viewCart}</Text>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.ink }}>{formatGel(subtotal)}</Text>
            </Pressable>
          </Bump>
        </SlideUp>
      )}
      <TabBar />
    </View>
  );
}
