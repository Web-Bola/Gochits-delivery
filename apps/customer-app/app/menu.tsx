import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, radius } from '@gochits/ui-tokens';
import { Body, Button, FadeIn, Stripe } from '../src/components/ui';
import { Bump, Float, FloatUp, PressScale, Shimmer, SlideUp } from '../src/components/fx';
import { menuImages } from '../src/lib/menuImages';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

interface Item { id: string; name: string; description_ka: string | null; price_tetri: number; old_price_tetri: number | null; image_path: string | null; category_id: string }
interface Cat { id: string; name_ka: string }

export default function Menu() {
  const router = useRouter();
  const { branch, address, add, count, subtotal } = useCart();
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[] | null>(null);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!branch) { router.replace('/branches'); return; }
    (async () => {
      const [c, bp] = await Promise.all([
        supabase.from('categories').select('id,name_ka').order('sort_order'),
        supabase.from('branch_products').select('is_available, price_override_tetri, products(id,name,description_ka,price_tetri,old_price_tetri,image_path,category_id,sort_order,is_active)').eq('branch_id', branch.branch_id),
      ]);
      setCats((c.data ?? []) as Cat[]);
      const rows = (bp.data ?? []) as unknown as { is_available: boolean; price_override_tetri: number | null; products: (Item & { is_active: boolean; sort_order: number }) | null }[];
      const list = rows.filter((r) => r.is_available && r.products?.is_active)
        .sort((a, b) => (a.products!.sort_order - b.products!.sort_order))
        .map((r) => ({ ...r.products!, price_tetri: r.price_override_tetri ?? r.products!.price_tetri }));
      setItems(list);
      setCat((c.data?.[0] as Cat | undefined)?.id ?? null);
    })();
  }, [branch, router]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((i) => (needle ? i.name.toLowerCase().includes(needle) : i.category_id === cat));
  }, [items, cat, q]);

  const [bumps, setBumps] = useState<Record<string, number>>({});
  if (!items) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <View style={{ backgroundColor: colors.yellow, height: 150 }} />
        <Stripe />
        <View style={{ padding: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} style={{ width: '47%', height: 190, borderRadius: 22 }} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={{ backgroundColor: colors.yellow, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Float amplitude={4} duration={1800}><Image source={require('../assets/logo.png')} style={{ height: 46, width: 70 }} resizeMode="contain" accessibilityLabel="Gochit's" /></Float>
          <Pressable accessibilityRole="button" accessibilityLabel={ka.branch.change} onPress={() => router.push('/branches')} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.ink, maxWidth: 260 }}>
            <Text numberOfLines={1} style={{ color: colors.yellow, fontFamily: fontFamily.extrabold, fontSize: 13 }}>{branch?.branch_name} ▾</Text>
          </Pressable>
        </View>
        <Text numberOfLines={1} style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: colors.ink }}>📍 {address?.street}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 14, minHeight: 48 }}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput accessibilityLabel={ka.menu.search} placeholder={ka.menu.search} placeholderTextColor={colors.muted} value={q} onChangeText={setQ}
            style={{ flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: colors.ink, minWidth: 0 }} />
        </View>
      </View>
      <Stripe />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, height: 64 }} contentContainerStyle={{ gap: 8, alignItems: 'center', paddingHorizontal: 20 }}>
        {cats.map((c) => {
          const on = cat === c.id && !q;
          return (
            <Pressable key={c.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => { setQ(''); setCat(c.id); }}
              style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', borderWidth: 2, borderColor: colors.ink, backgroundColor: on ? colors.ink : 'transparent' }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: on ? colors.yellow : colors.ink }}>{c.name_ka}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <FlatList data={shown} numColumns={2} key="grid" keyExtractor={(i) => i.id}
        columnWrapperStyle={{ gap: 12 }} contentContainerStyle={{ gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 130 }}
        ListHeaderComponent={<Body muted>{ka.menu.unapprovedPrices}</Body>}
        ListEmptyComponent={<Body muted>—</Body>}
        renderItem={({ item, index }) => {
          const img = item.image_path ? menuImages[item.image_path] : undefined;
          const onAdd = () => { add({ productId: item.id, name: item.name, unitPriceTetri: item.price_tetri }); setBumps((b) => ({ ...b, [item.id]: (b[item.id] ?? 0) + 1 })); };
          return (
            <FadeIn index={index} style={{ flex: 1 }}>
              <View style={{ backgroundColor: colors.white, borderRadius: radius.card, overflow: 'hidden', shadowColor: colors.ink, shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } }}>
                <View style={{ height: 118, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                  {img ? <Image source={img} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ color: colors.yellow, fontSize: 11, textAlign: 'center', fontFamily: fontFamily.extrabold }}>ფოტო{'\n'}არ არის</Text>}
                  {item.old_price_tetri ? <View style={{ position: 'absolute', left: 8, top: 8, backgroundColor: colors.red, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}><Text style={{ color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 11 }}>-{Math.round((1 - item.price_tetri / item.old_price_tetri) * 100)}%</Text></View> : null}
                </View>
                <View style={{ padding: 10, gap: 4 }}>
                  <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.ink }}>{item.name}</Text>
                  {item.description_ka ? <Text numberOfLines={2} style={{ fontFamily: fontFamily.regular, fontSize: 11, color: colors.muted, lineHeight: 15, minHeight: 30 }}>{item.description_ka}</Text> : <View style={{ minHeight: 30 }} />}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                    <View>
                      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.red }}>{formatGel(item.price_tetri)}</Text>
                      {item.old_price_tetri ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 11, color: colors.muted, textDecorationLine: 'line-through' }}>{formatGel(item.old_price_tetri)}</Text> : null}
                    </View>
                    <View>
                      <PressScale accessibilityRole="button" accessibilityLabel={`${ka.menu.add}: ${item.name}`} onPress={onAdd} scaleTo={0.8}
                        style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: colors.white, fontSize: 24, fontFamily: fontFamily.extrabold, marginTop: -2 }}>+</Text>
                      </PressScale>
                      <FloatUp trigger={bumps[item.id] ?? 0} />
                    </View>
                  </View>
                </View>
              </View>
            </FadeIn>
          );
        }} />
      {count > 0 && (
        <SlideUp style={{ position: 'absolute', left: 20, right: 20, bottom: 24 }}>
          <Bump value={count}><Button title={`🛒  ${ka.cart.title} · ${count} · ${formatGel(subtotal)}`} onPress={() => router.push('/cart')} variant="ink" /></Bump>
        </SlideUp>
      )}
    </View>
  );
}
