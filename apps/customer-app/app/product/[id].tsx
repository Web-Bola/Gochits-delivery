import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily } from '@gochits/ui-tokens';
import { BackButton } from '../../src/components/ui';
import { Bump, ND, PressScale, Spin, useReduceMotion } from '../../src/components/fx';
import { Heart, Photo, photoOf, Stepper } from '../../src/components/product';
import { buildNote, isExtraCategory, loadMenu, removableIngredients, type Menu, type Product } from '../../src/lib/menuData';
import { useCart } from '../../src/state/cart';
import { useFavorites } from '../../src/state/favorites';

const INK = colors.ink;
const CREAM = '#FFF8E1';
const SOFT = '#FFF1BF';
const MUTED = '#6b5a52';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { add, branch, ready } = useCart();
  const fav = useFavorites();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [failed, setFailed] = useState(false);
  const [qty, setQty] = useState(1);
  const [removed, setRemoved] = useState<Record<string, boolean>>({});
  const [extras, setExtras] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const hero = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();

  useEffect(() => {
    if (!ready) return;
    if (!branch) { router.replace('/branches'); return; }
    loadMenu(branch.id).then(setMenu).catch((e) => { console.warn('product load failed', e); setFailed(true); });
  }, [ready, branch, router]);

  const p = useMemo(() => menu?.products.find((x) => x.id === id) ?? null, [menu, id]);
  const cat = menu?.categories.find((c) => c.id === p?.category_id);
  const isMain = !!cat && !isExtraCategory(cat);
  const ingredients = useMemo(() => (isMain ? removableIngredients(p?.description_ka ?? null) : []), [isMain, p]);
  const groups = useMemo(() => {
    if (!menu || !isMain) return [] as { name: string; items: Product[] }[];
    return menu.categories.filter(isExtraCategory)
      .map((c) => ({ name: c.name_ka, items: menu.products.filter((x) => x.category_id === c.id && x.available) }))
      .filter((g) => g.items.length > 0);
  }, [menu, isMain]);

  useEffect(() => { if (p) Animated.spring(hero, { toValue: 1, friction: 5, tension: 50, useNativeDriver: ND }).start(); }, [p, hero]);

  if (failed) return <View style={{ flex: 1, backgroundColor: CREAM, padding: 20, gap: 14 }}><BackButton /><Text style={{ fontFamily: fontFamily.semibold, color: INK }}>{ka.errors.network}</Text></View>;
  if (!menu) return <View style={{ flex: 1, backgroundColor: CREAM, justifyContent: 'center' }}><ActivityIndicator color={INK} /></View>;
  if (!p) return <View style={{ flex: 1, backgroundColor: CREAM, padding: 20, gap: 14 }}><BackButton /><Text style={{ fontFamily: fontFamily.semibold, color: INK }}>{ka.product.notFound}</Text></View>;

  const extrasList = groups.flatMap((g) => g.items).filter((x) => (extras[x.id] ?? 0) > 0);
  const extrasTotal = extrasList.reduce((n, x) => n + x.price_tetri * (extras[x.id] ?? 0), 0);
  const total = p.price_tetri * qty + extrasTotal;
  const sold = !p.available;
  const heroStyle = reduce ? {} : { opacity: hero, transform: [{ scale: hero.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }, { rotate: hero.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '0deg'] }) }] };
  const img = photoOf(p.image_path);

  function addToCart() {
    if (!p || sold) return;
    const note = buildNote(ingredients.filter((i) => removed[i]), comment, ka.cart.removed);
    add({ productId: p.id, name: p.name, unitPriceTetri: p.price_tetri, note }, qty);
    for (const x of extrasList) add({ productId: x.id, name: x.name, unitPriceTetri: x.price_tetri }, extras[x.id] ?? 1);
    router.back();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: CREAM }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 150 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
          <View style={{ position: 'absolute', right: 18, top: 22 }}><Heart on={fav.ids.has(p.id)} onPress={() => fav.toggle(p.id)} size={44} /></View>
        </View>

        <View style={{ padding: 20, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 24, color: INK }}>{p.name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 22, color: colors.red }}>{formatGel(p.price_tetri)}</Text>
            {p.old_price_tetri ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: MUTED, textDecorationLine: 'line-through' }}>{formatGel(p.old_price_tetri)}</Text> : null}
          </View>
          {p.description_ka ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: MUTED, lineHeight: 21 }}>{p.description_ka}</Text> : null}
          {sold ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.red }}>{ka.menu.soldOut}</Text> : null}
          {p.price_source === 'unapproved' ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: MUTED, lineHeight: 18, backgroundColor: SOFT, borderRadius: 12, padding: 10, overflow: 'hidden' }}>{ka.menu.unapprovedPrices}</Text> : null}

          {ingredients.length > 0 && (
            <View style={{ gap: 8, marginTop: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: INK }}>ამოიღე ინგრედიენტი</Text>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: MUTED }}>არასავალდებულო</Text>
              </View>
              {ingredients.map((x) => {
                const on = !!removed[x];
                return (
                  <Pressable key={x} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setRemoved((r) => ({ ...r, [x]: !r[x] }))}
                    style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, borderRadius: 14, backgroundColor: on ? SOFT : colors.white, borderWidth: 2, borderColor: on ? colors.yellow : '#EFE3BC' }}>
                    <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: on ? INK : '#CDBE93', backgroundColor: on ? INK : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                      {on ? <Text style={{ color: colors.yellow, fontSize: 14, fontFamily: fontFamily.extrabold }}>✓</Text> : null}
                    </View>
                    <Text style={{ flex: 1, fontFamily: fontFamily.semibold, fontSize: 14, color: INK, textDecorationLine: on ? 'line-through' : 'none' }}>{x}</Text>
                    <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: MUTED }}>ამოღება</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {groups.map((g) => (
            <View key={g.name} style={{ gap: 8, marginTop: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: INK }}>{g.name}</Text>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: MUTED }}>არასავალდებულო</Text>
              </View>
              {g.items.map((x) => {
                const n = extras[x.id] ?? 0;
                return (
                  <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 16, backgroundColor: n > 0 ? SOFT : colors.white, borderWidth: 2, borderColor: n > 0 ? colors.yellow : '#EFE3BC' }}>
                    <Photo path={x.image_path} style={{ width: 48, height: 48 }} rounded={12} />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: INK }}>{x.name}</Text>
                      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.red }}>+{formatGel(x.price_tetri)}</Text>
                    </View>
                    <Stepper tone="light" value={n} max={10} onMinus={() => setExtras((e) => ({ ...e, [x.id]: Math.max(0, (e[x.id] ?? 0) - 1) }))} onPlus={() => setExtras((e) => ({ ...e, [x.id]: (e[x.id] ?? 0) + 1 }))} />
                  </View>
                );
              })}
            </View>
          ))}

          {isMain && (
            <View style={{ gap: 6, marginTop: 6 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: INK }}>კომენტარი</Text>
              <TextInput accessibilityLabel="კომენტარი" placeholder="მაგ. კარგად შემწვარი" placeholderTextColor="#9b8a80" value={comment} onChangeText={setComment} maxLength={120} multiline
                style={[{ minHeight: 64, borderRadius: 14, borderWidth: 2, borderColor: '#EFE3BC', backgroundColor: colors.white, padding: 12, fontFamily: fontFamily.regular, fontSize: 14, color: INK, textAlignVertical: 'top' }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 22, backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: INK, shadowOpacity: 0.1, shadowRadius: 24, shadowOffset: { width: 0, height: -8 } }}>
        <Stepper tone="light" value={qty} min={1} max={20} onMinus={() => setQty((q) => Math.max(1, q - 1))} onPlus={() => setQty((q) => Math.min(20, q + 1))} />
        <View style={{ flex: 1 }}>
          <PressScale accessibilityRole="button" accessibilityLabel={ka.product.addFor} accessibilityState={{ disabled: sold }} disabled={sold} scaleTo={0.97}
            style={{ minHeight: 56, borderRadius: 28, backgroundColor: sold ? '#BDB09F' : colors.red, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }} onPress={addToCart}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.white }}>{sold ? ka.menu.soldOut : ka.product.addFor}</Text>
            <Bump value={total}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.white }}>{formatGel(total)}</Text></Bump>
          </PressScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
