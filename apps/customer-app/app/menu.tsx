import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Image, Platform, Pressable, ScrollView, Text, TextInput, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, radius, theme } from '@gochits/ui-tokens';
import { Body, Button, FadeIn, Stripe } from '../src/components/ui';
import { TabBar } from '../src/components/TabBar';
import { Bump, Float, FloatUp, PressScale, Shimmer, SlideUp, useReduceMotion } from '../src/components/fx';
import { menuImages } from '../src/lib/menuImages';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

interface Item { id: string; name: string; description_ka: string | null; price_tetri: number; old_price_tetri: number | null; image_path: string | null; category_id: string }
interface Cat { id: string; name_ka: string }

const FRAME = Platform.OS === 'web' ? Math.min(430, Dimensions.get('window').width) : Dimensions.get('window').width;

function discount(i: Item): number | null {
  return i.old_price_tetri && i.old_price_tetri > i.price_tetri ? Math.round((1 - i.price_tetri / i.old_price_tetri) * 100) : null;
}

function ProductCard({ item, width, onAdd, onOpen, bumped }: { item: Item; width: number | `${number}%`; onAdd: () => void; onOpen: () => void; bumped: number }) {
  const img = item.image_path ? menuImages[item.image_path] : undefined;
  const off = discount(item);
  return (
    <View style={{ width, backgroundColor: theme.surface, borderRadius: radius.card, overflow: 'hidden', borderWidth: 1, borderColor: theme.border }}>
      <View style={{ height: 130, backgroundColor: theme.surface2, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={onOpen} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        {img ? <Image source={img} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ color: theme.muted, fontSize: 11, textAlign: 'center', fontFamily: fontFamily.extrabold }}>ფოტო{'\n'}არ არის</Text>}
        </Pressable>
        {off ? <View style={{ position: 'absolute', left: 8, top: 8, backgroundColor: colors.yellow, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: colors.ink, fontFamily: fontFamily.extrabold, fontSize: 12 }}>-{off}%</Text></View> : null}
        <View style={{ position: 'absolute', right: 8, bottom: 8 }}>
          <PressScale accessibilityRole="button" accessibilityLabel={`${ka.menu.add}: ${item.name}`} onPress={onAdd} scaleTo={0.8}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8 }}>
            <Text style={{ color: colors.white, fontSize: 24, fontFamily: fontFamily.extrabold, marginTop: -2 }}>+</Text>
          </PressScale>
          <FloatUp trigger={bumped} />
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} ·`} onPress={onOpen} style={{ padding: 12, gap: 3 }}>
        <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{item.name}</Text>
        <Text numberOfLines={1} style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{item.description_ka ?? ' '}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.yellow }}>{formatGel(item.price_tetri)}</Text>
          {item.old_price_tetri ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted, textDecorationLine: 'line-through' }}>{formatGel(item.old_price_tetri)}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}

/** Auto-sliding banner of featured products (items that have a photo). No promo claims: only name, price and observed discount. */
function Banners({ items, onAdd }: { items: Item[]; onAdd: (i: Item) => void }) {
  const ref = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const reduce = useReduceMotion();
  const w = FRAME - 40;
  useEffect(() => {
    if (reduce || items.length < 2) return;
    const t = setInterval(() => setPage((p) => {
      const n = (p + 1) % items.length;
      ref.current?.scrollTo({ x: n * (w + 12), animated: true });
      return n;
    }), 4200);
    return () => clearInterval(t);
  }, [items.length, reduce, w]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / (w + 12)));
  return (
    <View style={{ gap: 10 }}>
      <ScrollView ref={ref} horizontal pagingEnabled={false} snapToInterval={w + 12} decelerationRate="fast" showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {items.map((it) => {
          const off = discount(it);
          return (
            <View key={it.id} style={{ width: w, height: 190, borderRadius: 26, overflow: 'hidden', backgroundColor: theme.surface2 }}>
              <Image source={menuImages[it.image_path!]} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
              <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(20,11,10,0.55)' }} />
              <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
                {off ? <View style={{ alignSelf: 'flex-start', backgroundColor: colors.yellow, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 }}><Text style={{ color: colors.ink, fontFamily: fontFamily.extrabold, fontSize: 14 }}>-{off}%</Text></View> : <View />}
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 24, color: colors.white }}>{it.name}</Text>
                    <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: colors.yellow }}>{formatGel(it.price_tetri)}</Text>
                  </View>
                  <PressScale accessibilityRole="button" accessibilityLabel={`${ka.menu.add}: ${it.name}`} onPress={() => onAdd(it)} scaleTo={0.85}
                    style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.white, fontSize: 26, fontFamily: fontFamily.extrabold, marginTop: -2 }}>+</Text>
                  </PressScale>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {items.map((_, i) => <View key={i} style={{ width: i === page ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? colors.yellow : theme.border }} />)}
      </View>
    </View>
  );
}

export default function Menu() {
  const router = useRouter();
  const { branch, address, add, count, subtotal } = useCart();
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[] | null>(null);
  const [cat, setCat] = useState<string | 'all'>('all');
  const [q, setQ] = useState('');
  const [bumps, setBumps] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!branch) { router.replace('/branches'); return; }
    (async () => {
      const [c, bp] = await Promise.all([
        supabase.from('categories').select('id,name_ka').order('sort_order'),
        supabase.from('branch_products').select('is_available, price_override_tetri, products(id,name,description_ka,price_tetri,old_price_tetri,image_path,category_id,sort_order,is_active)').eq('branch_id', branch.branch_id),
      ]);
      setCats((c.data ?? []) as Cat[]);
      const rows = (bp.data ?? []) as unknown as { is_available: boolean; price_override_tetri: number | null; products: (Item & { is_active: boolean; sort_order: number }) | null }[];
      setItems(rows.filter((r) => r.is_available && r.products?.is_active)
        .sort((a, b) => (a.products!.sort_order - b.products!.sort_order))
        .map((r) => ({ ...r.products!, price_tetri: r.price_override_tetri ?? r.products!.price_tetri })));
    })();
  }, [branch, router]);

  const addItem = (item: Item) => {
    add({ productId: item.id, name: item.name, unitPriceTetri: item.price_tetri });
    setBumps((b) => ({ ...b, [item.id]: (b[item.id] ?? 0) + 1 }));
  };

  const byCat = useMemo(() => cats.map((c) => ({ cat: c, list: (items ?? []).filter((i) => i.category_id === c.id) })).filter((x) => x.list.length > 0), [cats, items]);
  const featured = useMemo(() => (items ?? []).filter((i) => i.image_path && menuImages[i.image_path]).slice(0, 5), [items]);
  const tileImage = (list: Item[]) => list.find((i) => i.image_path && menuImages[i.image_path]);
  const needle = q.trim().toLowerCase();
  const searching = needle.length > 0;
  const gridItems = searching ? (items ?? []).filter((i) => i.name.toLowerCase().includes(needle)) : cat === 'all' ? [] : (items ?? []).filter((i) => i.category_id === cat);

  if (!items) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <View style={{ height: 140 }} />
        <Stripe height={8} />
        <View style={{ padding: 20, gap: 12 }}>
          <Shimmer style={{ height: 190, borderRadius: 26, backgroundColor: theme.surface2 }} />
          <View style={{ flexDirection: 'row', gap: 12 }}>{[0, 1].map((i) => <Shimmer key={i} style={{ flex: 1, height: 200, borderRadius: 22, backgroundColor: theme.surface2 }} />)}</View>
        </View>
      </View>
    );
  }

  const cardW = Math.min(240, FRAME * 0.58);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ backgroundColor: theme.bg, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Float amplitude={3} duration={1800}><Image source={require('../assets/logo.png')} style={{ height: 44, width: 66 }} resizeMode="contain" accessibilityLabel="Gochit's" /></Float>
          <Pressable accessibilityRole="button" accessibilityLabel={ka.branch.change} onPress={() => router.push('/branches')}
            style={{ flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 22, backgroundColor: theme.surface }}>
            <Text style={{ fontSize: 15 }}>📍</Text>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: theme.text }}>{address?.street}</Text>
              <Text numberOfLines={1} style={{ fontFamily: fontFamily.regular, fontSize: 11, color: theme.muted }}>{branch?.branch_name}</Text>
            </View>
            <Text style={{ color: colors.yellow, fontSize: 14 }}>▾</Text>
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 24, paddingHorizontal: 16, minHeight: 48 }}>
          <Text style={{ fontSize: 15 }}>🔍</Text>
          <TextInput accessibilityLabel={ka.menu.search} placeholder={ka.menu.search} placeholderTextColor={theme.muted} value={q} onChangeText={setQ}
            style={[{ flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: theme.text, minWidth: 0 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 190, gap: 22 }} showsVerticalScrollIndicator={false}>
        {/* category tiles */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
          {[{ id: 'all', name_ka: 'ყველა' } as Cat, ...byCat.map((x) => x.cat)].map((c, i) => {
            const on = cat === c.id && !searching;
            const t = c.id === 'all' ? featured[0] : tileImage(byCat.find((x) => x.cat.id === c.id)?.list ?? []);
            return (
              <FadeIn key={c.id} index={i}>
                <Pressable accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setQ(''); setCat(c.id); }} style={{ width: 88, alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 88, height: 88, borderRadius: 22, overflow: 'hidden', backgroundColor: theme.surface2, borderWidth: 3, borderColor: on ? colors.yellow : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {t ? <Image source={menuImages[t.image_path!]} style={{ width: '100%', height: '100%' }} /> : <Text style={{ fontSize: 30 }}>{c.id === 'all' ? '🍔' : '🥤'}</Text>}
                  </View>
                  <Text numberOfLines={2} style={{ fontFamily: on ? fontFamily.extrabold : fontFamily.semibold, fontSize: 12, color: on ? colors.yellow : theme.text, textAlign: 'center' }}>{c.name_ka}</Text>
                </Pressable>
              </FadeIn>
            );
          })}
        </ScrollView>

        {cat === 'all' && !searching && (
          <>
            {featured.length > 0 && <Banners items={featured} onAdd={addItem} />}
            <View style={{ paddingHorizontal: 20 }}><Text style={{ fontFamily: fontFamily.regular, fontSize: 11, color: theme.muted }}>{ka.menu.unapprovedPrices}</Text></View>
            {byCat.map(({ cat: c, list }) => (
              <View key={c.id} style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }}>
                  <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text }}>{c.name_ka}</Text>
                  <Pressable accessibilityRole="button" onPress={() => setCat(c.id)}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.yellow }}>სრულად ნახვა</Text></Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}>
                  {list.map((it, i) => <FadeIn key={it.id} index={i}><ProductCard item={it} width={cardW} onAdd={() => addItem(it)} onOpen={() => router.push({ pathname: '/product/[id]', params: { id: it.id } })} bumped={bumps[it.id] ?? 0} /></FadeIn>)}
                </ScrollView>
              </View>
            ))}
          </>
        )}
        {(cat !== 'all' || searching) && (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text }}>{searching ? ka.menu.search : cats.find((c) => c.id === cat)?.name_ka}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {gridItems.map((it, i) => <FadeIn key={it.id} index={i} style={{ width: '47.5%' }}><ProductCard item={it} width="100%" onAdd={() => addItem(it)} onOpen={() => router.push({ pathname: '/product/[id]', params: { id: it.id } })} bumped={bumps[it.id] ?? 0} /></FadeIn>)}
            </View>
            {gridItems.length === 0 && <Body muted>—</Body>}
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
