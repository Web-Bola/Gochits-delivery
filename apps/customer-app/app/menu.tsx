import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { formatGel, productQuantity } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, FadeIn, Stripe } from '../src/components/ui';
import { TabBar } from '../src/components/TabBar';
import { Bump, Float, PressScale, Shimmer, SlideUp } from '../src/components/fx';
import { Banners, FRAME } from '../src/components/Banners';
import { ProductCard } from '../src/components/product';
import { discountPercent, isSpicy, loadMenu, type Menu, type Product } from '../src/lib/menuData';
import { photoOf } from '../src/components/product';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';
import { useFavorites } from '../src/state/favorites';

type Filter = 'deals' | 'spicy' | 'price' | null;
interface BranchState { is_open: boolean; accepts_orders: boolean }

export default function MenuScreen() {
  const router = useRouter();
  const { ready, branch, lines, add, count, subtotal } = useCart();
  const fav = useFavorites();
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
      const me = ((data ?? []) as { id: string; is_open: boolean; accepts_orders: boolean }[]).find((b) => b.id === branch.id);
      setState(me ? { is_open: me.is_open, accepts_orders: me.accepts_orders } : null);
    } catch (e) { console.warn('menu load failed', e); setFailed(true); }
  }, [branch]);

  useEffect(() => {
    if (!ready) return;
    if (!branch) { router.replace('/branches'); return; }
    load();
  }, [ready, branch, load, router]);

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

  const cardW = '47.5%' as const;
  const grid = (list: Product[]) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20 }}>
      {list.map((it, i) => (
        <FadeIn key={it.id} index={i} style={{ width: cardW }}>
          <ProductCard item={it} width="100%" qty={productQuantity(lines, it.id)} fav={fav.ids.has(it.id)} bumped={bumps[it.id] ?? 0}
            onAdd={() => addItem(it)} onOpen={() => open(it)} onFav={() => fav.toggle(it.id)} />
        </FadeIn>
      ))}
    </View>
  );

  const chip = (id: Exclude<Filter, null>, label: string) => {
    const on = filter === id;
    return (
      <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFilter(on ? null : id)}
        style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center', backgroundColor: on ? colors.yellow : theme.surface, borderWidth: 1, borderColor: on ? colors.yellow : theme.border }}>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: on ? colors.ink : theme.text }}>{label}</Text>
      </Pressable>
    );
  };

  const header = (
    <View style={{ backgroundColor: theme.bg, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Float amplitude={3} duration={1800}><Image source={require('../assets/logo.png')} style={{ height: 44, width: 66 }} resizeMode="contain" accessibilityLabel="Gochit's" /></Float>
        <Pressable accessibilityRole="button" accessibilityLabel={ka.branch.change} onPress={() => router.push('/branches')}
          style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 22, backgroundColor: theme.surface }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: state && state.is_open && state.accepts_orders ? '#3DDC84' : colors.red }} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: theme.text }}>{branch?.name}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fontFamily.regular, fontSize: 11, color: theme.muted }}>{state ? (state.accepts_orders ? (state.is_open ? ka.branch.open : ka.branch.closedNow) : ka.branch.notAccepting) : ' '}</Text>
          </View>
          <Text style={{ color: colors.yellow, fontSize: 14 }}>▾</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 24, paddingHorizontal: 16, minHeight: 48 }}>
        <Text style={{ fontSize: 15 }}>🔍</Text>
        <TextInput accessibilityLabel={ka.menu.search} placeholder={ka.menu.search} placeholderTextColor={theme.muted} value={q} onChangeText={setQ}
          style={[{ flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: theme.text, minWidth: 0 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
        {q ? <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={() => setQ('')}><Text style={{ color: theme.muted, fontSize: 16, padding: 6 }}>✕</Text></Pressable> : null}
      </View>
    </View>
  );

  if (!ready || (!menu && !failed)) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {header}<Stripe height={8} />
        <View style={{ padding: 20, gap: 12 }}>
          <Shimmer style={{ height: 180, borderRadius: 26, backgroundColor: theme.surface2 }} />
          <View style={{ flexDirection: 'row', gap: 12 }}>{[0, 1].map((i) => <Shimmer key={i} style={{ flex: 1, height: 200, borderRadius: 22, backgroundColor: theme.surface2 }} />)}</View>
        </View>
        <TabBar />
      </View>
    );
  }
  if (failed || !menu) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        {header}<Stripe height={8} />
        <View style={{ padding: 30, alignItems: 'center', gap: 14 }}>
          <Text style={{ fontSize: 56 }}>📡</Text>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{ka.menu.loadFail}</Text>
          <Body muted>{ka.errors.network}</Body>
          <Button title={ka.common.retry} onPress={load} variant="ink" />
        </View>
        <TabBar />
      </View>
    );
  }

  const unapproved = menu.products.some((p) => p.price_source === 'unapproved');
  const closed = state !== null && (!state.is_open || !state.accepts_orders);
  const mains = shown;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {header}
      <ScrollView ref={scroller} stickyHeaderIndices={[2]} onScroll={onScroll} scrollEventThrottle={32} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 190 }}>
        <View style={{ gap: 14, paddingBottom: 14 }}>
          {closed ? (
            <View style={{ marginHorizontal: 20, backgroundColor: theme.surface, borderRadius: 16, padding: 12, borderWidth: 1, borderColor: colors.red }}>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: theme.text }}>{state && !state.accepts_orders ? ka.branch.notAccepting : ka.branch.closedBanner}</Text>
            </View>
          ) : null}
          {!flat && deals.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text, paddingHorizontal: 20 }}>{ka.menu.dealsTitle}</Text>
              <Banners items={deals} onAdd={addItem} onOpen={open} />
            </View>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 12 }}>
          {chip('deals', ka.menu.discounts)}{chip('spicy', ka.menu.spicy)}{chip('price', ka.menu.priceAsc)}
        </ScrollView>

        <View onLayout={(e: LayoutChangeEvent) => { tabsH.current = e.nativeEvent.layout.height; }} style={{ backgroundColor: theme.bg }}>
          {!flat ? (
            <ScrollView ref={tabStrip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 8 }}>
              {mains.map(({ cat }) => {
                const on = active === cat.id;
                return (
                  <Pressable key={cat.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => goTo(cat.id)}
                    onLayout={(e: LayoutChangeEvent) => { tabX.current[cat.id] = e.nativeEvent.layout.x; }}
                    style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center', backgroundColor: on ? colors.yellow : theme.surface }}>
                    <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: on ? colors.ink : theme.text }}>{cat.name_ka}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : <View style={{ height: 1 }} />}
        </View>

        {flat ? (
          <View style={{ gap: 12, paddingTop: 6 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text, paddingHorizontal: 20 }}>{needle ? ka.menu.search : filter === 'deals' ? ka.menu.discounts : filter === 'spicy' ? ka.menu.spicy : ka.menu.priceAsc}</Text>
            {results.length > 0 ? grid(results) : <View style={{ alignItems: 'center', gap: 8, padding: 30 }}><Text style={{ fontSize: 44 }}>🔎</Text><Body muted>{ka.menu.nothing}</Body></View>}
          </View>
        ) : (
          <View onLayout={(e: LayoutChangeEvent) => { contentY.current = e.nativeEvent.layout.y; }} style={{ gap: 22, paddingTop: 10 }}>
            {unapproved ? <View style={{ paddingHorizontal: 20 }}><Text style={{ fontFamily: fontFamily.regular, fontSize: 11, color: theme.muted }}>{ka.menu.unapprovedPrices}</Text></View> : null}
            {mains.map(({ cat, list }) => (
              <View key={cat.id} onLayout={(e: LayoutChangeEvent) => { secY.current[cat.id] = e.nativeEvent.layout.y; }} style={{ gap: 12 }}>
                <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text, paddingHorizontal: 20 }}>{cat.name_ka}</Text>
                {grid(list)}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {count > 0 && (
        <SlideUp style={{ position: 'absolute', left: 20, right: 20, bottom: 76 }}>
          <Bump value={count}><Button title={`🛒  ${ka.cart.title} · ${count} · ${formatGel(subtotal)}`} onPress={() => router.push('/cart')} variant="ink" /></Bump>
        </SlideUp>
      )}
      <TabBar />
    </View>
  );
}
