import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily } from '@gochits/ui-tokens';
import { BackButton } from '../../src/components/ui';
import { Bump, ND, PressScale, Spin, useReduceMotion } from '../../src/components/fx';
import { menuImages } from '../../src/lib/menuImages';
import { supabase } from '../../src/lib/supabase';
import { useCart } from '../../src/state/cart';

interface P { id: string; name: string; description_ka: string | null; price_tetri: number; old_price_tetri: number | null; image_path: string | null }

// Product screen from the first design: yellow hero with a spinning dashed ring and a round photo, light sheet, qty pill + red add button.
// Variants/extras from the mockup are NOT shown: the restaurant has not confirmed any.
const INK = colors.ink;
const CREAM = '#FFF8E1';
const SOFT = '#FFF1BF';

export default function Product() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { add, branch } = useCart();
  const [p, setP] = useState<P | null>(null);
  const [missing, setMissing] = useState(false);
  const [qty, setQty] = useState(1);
  const hero = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();

  useEffect(() => {
    if (!branch) { router.replace('/branches'); return; }
    supabase.from('branch_products').select('price_override_tetri, products(id,name,description_ka,price_tetri,old_price_tetri,image_path)')
      .eq('branch_id', branch.branch_id).eq('product_id', id).maybeSingle().then(({ data }) => {
        const row = data as unknown as { price_override_tetri: number | null; products: P | null } | null;
        if (!row?.products) { setMissing(true); return; }
        setP({ ...row.products, price_tetri: row.price_override_tetri ?? row.products.price_tetri });
      });
  }, [id, branch, router]);
  useEffect(() => {
    if (p) Animated.spring(hero, { toValue: 1, friction: 5, tension: 50, useNativeDriver: ND }).start();
  }, [p, hero]);

  if (missing) return <View style={{ flex: 1, backgroundColor: CREAM, padding: 20, gap: 14 }}><BackButton /><Text style={{ fontFamily: fontFamily.semibold, color: INK }}>{ka.product.notFound}</Text></View>;
  if (!p) return <View style={{ flex: 1, backgroundColor: CREAM, justifyContent: 'center' }}><ActivityIndicator color={INK} /></View>;
  const img = p.image_path ? menuImages[p.image_path] : undefined;
  const heroStyle = reduce ? {} : { opacity: hero, transform: [{ scale: hero.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }, { rotate: hero.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '0deg'] }) }] };

  const stepBtn = (kind: 'minus' | 'plus', fn: () => void) => (
    <PressScale accessibilityRole="button" accessibilityLabel={kind === 'plus' ? 'გაზრდა' : 'შემცირება'} onPress={fn} scaleTo={0.85}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: kind === 'plus' ? INK : colors.white, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 24, color: kind === 'plus' ? colors.yellow : INK, marginTop: -3 }}>{kind === 'plus' ? '+' : '−'}</Text>
    </PressScale>
  );

  return (
    <View style={{ flex: 1, backgroundColor: CREAM }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 290, backgroundColor: colors.yellow, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
          <Spin style={{ position: 'absolute', width: 340, height: 340, borderRadius: 170, borderWidth: 3, borderStyle: 'dashed', borderColor: 'rgba(26,13,11,0.25)' }} />
          <View style={{ position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: '#FFE066' }} />
          <Animated.View style={[{ width: 200, height: 200, borderRadius: 100, overflow: 'hidden', backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', shadowColor: INK, shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 14 } }, heroStyle]}>
            {img ? <Image source={img} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Text style={{ color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 16 }}>{ka.product.noPhoto}</Text>}
          </Animated.View>
          <View style={{ position: 'absolute', left: 18, top: 22 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="უკან" onPress={() => (router.canGoBack() ? router.back() : router.replace('/menu'))}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: INK, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: colors.yellow, fontSize: 22, fontFamily: fontFamily.extrabold, marginTop: -2 }}>←</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ padding: 20, gap: 10 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 24, color: INK }}>{p.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 22, color: colors.red }}>{formatGel(p.price_tetri)}</Text>
            {p.old_price_tetri ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: '#6b5a52', textDecorationLine: 'line-through' }}>{formatGel(p.old_price_tetri)}</Text> : null}
          </View>
          {p.description_ka ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: '#6b5a52', lineHeight: 21 }}>{p.description_ka}</Text> : null}
          <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: '#6b5a52', lineHeight: 18, backgroundColor: SOFT, borderRadius: 12, padding: 10, overflow: 'hidden' }}>{ka.menu.unapprovedPrices}</Text>
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 22, backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: INK, shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: -8 } }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: SOFT, borderRadius: 28, padding: 4 }}>
          {stepBtn('minus', () => setQty((q) => Math.max(1, q - 1)))}
          <Bump value={qty}><Text style={{ minWidth: 26, textAlign: 'center', fontFamily: fontFamily.extrabold, fontSize: 18, color: INK }}>{qty}</Text></Bump>
          {stepBtn('plus', () => setQty((q) => Math.min(20, q + 1)))}
        </View>
        <View style={{ flex: 1 }}><PressScale accessibilityRole="button" accessibilityLabel={ka.product.addFor} scaleTo={0.97} style={{ minHeight: 56, borderRadius: 28, backgroundColor: colors.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}
          onPress={() => { for (let i = 0; i < qty; i++) add({ productId: p.id, name: p.name, unitPriceTetri: p.price_tetri }); router.back(); }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.white }}>{ka.product.addFor}</Text>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.white }}>{formatGel(p.price_tetri * qty)}</Text>
        </PressScale></View>
      </View>
    </View>
  );
}
