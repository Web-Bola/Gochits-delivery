import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, radius } from '@gochits/ui-tokens';
import { Body, Button, Screen } from '../src/components/ui';
import { menuImages } from '../src/lib/menuImages';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

interface Item { id: string; name: string; description_ka: string | null; price_tetri: number; old_price_tetri: number | null; image_path: string | null; category_id: string }
interface Cat { id: string; name_ka: string }

export default function Menu() {
  const router = useRouter();
  const { branch, add, count, subtotal } = useCart();
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<Item[] | null>(null);
  const [cat, setCat] = useState<string | null>(null);

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

  const shown = useMemo(() => (items ?? []).filter((i) => i.category_id === cat), [items, cat]);
  if (!items) return <Screen><ActivityIndicator color={colors.ink} /></Screen>;

  return (
    <Screen>
      <Pressable accessibilityRole="button" onPress={() => router.push('/branches')} style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, backgroundColor: colors.ink }}>
        <Text style={{ color: colors.yellow, fontFamily: fontFamily.extrabold, fontSize: 13 }}>{branch?.branch_name} · {ka.branch.change}</Text>
      </Pressable>
      <Body muted>{ka.menu.unapprovedPrices}</Body>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8 }}>
        {cats.map((c) => (
          <Pressable key={c.id} accessibilityRole="tab" accessibilityState={{ selected: cat === c.id }} onPress={() => setCat(c.id)}
            style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 22, justifyContent: 'center', borderWidth: 2, borderColor: colors.ink, backgroundColor: cat === c.id ? colors.ink : 'transparent' }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: cat === c.id ? colors.yellow : colors.ink }}>{c.name_ka}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList data={shown} keyExtractor={(i) => i.id} contentContainerStyle={{ gap: 12, paddingBottom: 110 }}
        renderItem={({ item }) => {
          const img = item.image_path ? menuImages[item.image_path] : undefined;
          return (
            <View style={{ flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: radius.card, padding: 10 }}>
              <View style={{ width: 96, height: 96, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }}>
                {img ? <Image source={img} style={{ width: '100%', height: '100%' }} /> : <Text style={{ color: colors.yellow, fontSize: 11, textAlign: 'center', fontFamily: fontFamily.extrabold }}>ფოტო{'\n'}არ არის</Text>}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.ink }}>{item.name}</Text>
                {item.description_ka && <Text numberOfLines={2} style={{ fontFamily: fontFamily.regular, fontSize: 12, color: colors.muted }}>{item.description_ka}</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                  <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.red }}>{formatGel(item.price_tetri)}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${ka.menu.add}: ${item.name}`} onPress={() => add({ productId: item.id, name: item.name, unitPriceTetri: item.price_tetri })}
                    style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.white, fontSize: 24, fontFamily: fontFamily.extrabold }}>+</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        }} />
      {count > 0 && (
        <View style={{ position: 'absolute', left: 20, right: 20, bottom: 24 }}>
          <Button title={`${ka.cart.title} · ${count} · ${formatGel(subtotal)}`} onPress={() => router.push('/cart')} variant="ink" />
        </View>
      )}
    </Screen>
  );
}
