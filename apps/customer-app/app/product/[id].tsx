import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { BackButton } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { Bump, PressScale } from '../../src/components/fx';
import { photoOf, Scrim, Stepper } from '../../src/components/product';
import { buildNote, discountPercent, isExtraCategory, loadMenu, removableIngredients, type Menu, type Product } from '../../src/lib/menuData';
import { useCart } from '../../src/state/cart';
import { useFavorites } from '../../src/state/favorites';


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

  useEffect(() => {
    if (!ready) return;
    if (!branch) { router.replace('/home'); return; }
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

  if (failed) return <View style={{ flex: 1, backgroundColor: theme.bg, padding: 20, gap: 14 }}><BackButton /><Text style={{ fontFamily: fontFamily.semibold, color: theme.text }}>{ka.errors.network}</Text></View>;
  if (!menu) return <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.brand} /></View>;
  if (!p) return <View style={{ flex: 1, backgroundColor: theme.bg, padding: 20, gap: 14 }}><BackButton /><Text style={{ fontFamily: fontFamily.semibold, color: theme.text }}>{ka.product.notFound}</Text></View>;

  const extrasList = groups.flatMap((g) => g.items).filter((x) => (extras[x.id] ?? 0) > 0);
  const extrasTotal = extrasList.reduce((n, x) => n + x.price_tetri * (extras[x.id] ?? 0), 0);
  const total = p.price_tetri * qty + extrasTotal;
  const sold = !p.available;
  const img = photoOf(p.image_path);
  const off = discountPercent(p);

  function addToCart() {
    if (!p || sold) return;
    const note = buildNote(ingredients.filter((i) => removed[i]), comment, ka.cart.removed);
    add({ productId: p.id, name: p.name, unitPriceTetri: p.price_tetri, note }, qty);
    for (const x of extrasList) add({ productId: x.id, name: x.name, unitPriceTetri: x.price_tetri }, extras[x.id] ?? 1);
    router.back();
  }

  const roundBtn = { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } } as const;
  const headRow = (title: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16, paddingBottom: 6, borderTopWidth: 1, borderTopColor: theme.border }}>
      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{title}</Text>
      <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12, color: theme.muted, backgroundColor: theme.surface, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 2, overflow: 'hidden' }}>არასავალდებულო</Text>
    </View>
  );
  const box = (on: boolean) => (
    <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: on ? colors.brand : '#4A5C80', backgroundColor: on ? colors.brand : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
      {on ? <Icon name="check" size={15} color={colors.onBrand} strokeWidth={3} /> : null}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={{ height: 330, backgroundColor: theme.surface }}>
          {img ? <Image source={img} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : null}
          <Scrim side="top" height={100} max={0.4} />
          <Scrim side="bottom" height={190} max={0.92} />
          <View style={{ position: 'absolute', left: 16, top: 16 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="დახურვა" onPress={() => (router.canGoBack() ? router.back() : router.replace('/menu'))} style={roundBtn}>
              <Icon name="x" size={22} color="#0B1424" />
            </Pressable>
          </View>
          <View style={{ position: 'absolute', right: 16, top: 16 }}>
            <PressScale accessibilityRole="button" accessibilityLabel={fav.ids.has(p.id) ? ka.menu.favRemove : ka.menu.favAdd} onPress={() => fav.toggle(p.id)} scaleTo={0.85}
              style={{ ...roundBtn, backgroundColor: fav.ids.has(p.id) ? colors.red : colors.white }}>
              <Icon name="heart" size={22} color={fav.ids.has(p.id) ? colors.white : '#0B1424'} fill={fav.ids.has(p.id) ? colors.white : 'none'} />
            </PressScale>
          </View>
          <View style={{ position: 'absolute', left: 20, right: 20, bottom: 16, gap: 4 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 26, color: colors.white, lineHeight: 32 }}>{p.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: colors.white }}>{formatGel(p.price_tetri)}</Text>
              {p.old_price_tetri ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 15, color: '#6F7F9B', textDecorationLine: 'line-through' }}>{formatGel(p.old_price_tetri)}</Text> : null}
              {off ? <View style={{ backgroundColor: colors.brand, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}><Text style={{ color: colors.onBrand, fontFamily: fontFamily.extrabold, fontSize: 12 }}>-{off}%</Text></View> : null}
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 14, gap: 4 }}>
          {p.description_ka ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.muted, lineHeight: 21, paddingBottom: 6 }}>{p.description_ka}</Text> : null}
          {sold ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.red }}>{ka.menu.soldOut}</Text> : null}
          {p.price_source === 'unapproved' ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted, lineHeight: 18, backgroundColor: theme.surface, borderRadius: 12, padding: 10, overflow: 'hidden' }}>{ka.menu.unapprovedPrices}</Text> : null}

          {ingredients.length > 0 && (
            <View>
              {headRow('ამოიღე ინგრედიენტი')}
              {ingredients.map((x) => {
                const on = !!removed[x];
                return (
                  <Pressable key={x} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => setRemoved((r) => ({ ...r, [x]: !r[x] }))}
                    style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                    {box(on)}
                    <Text style={{ flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: theme.text, textDecorationLine: on ? 'line-through' : 'none' }}>{x}</Text>
                    <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.muted }}>ამოღება</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {groups.map((g) => (
            <View key={g.name}>
              {headRow(g.name)}
              {g.items.map((x) => {
                const n = extras[x.id] ?? 0;
                return (
                  <View key={x.id} style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: n > 0 }} onPress={() => setExtras((e) => ({ ...e, [x.id]: n > 0 ? 0 : 1 }))} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      {box(n > 0)}
                      <Text numberOfLines={2} style={{ flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: theme.text }}>{x.name}</Text>
                      <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.muted }}>+{formatGel(x.price_tetri)}</Text>
                    </Pressable>
                    {n > 0 ? <Stepper value={n} max={10} onMinus={() => setExtras((e) => ({ ...e, [x.id]: Math.max(0, (e[x.id] ?? 0) - 1) }))} onPlus={() => setExtras((e) => ({ ...e, [x.id]: (e[x.id] ?? 0) + 1 }))} /> : null}
                  </View>
                );
              })}
            </View>
          ))}

          {isMain && (
            <View style={{ gap: 6, paddingTop: 16 }}>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: theme.text }}>კომენტარი ბურგერზე</Text>
              <TextInput accessibilityLabel="კომენტარი" placeholder="მაგ. კარგად შემწვარი" placeholderTextColor={theme.muted} value={comment} onChangeText={setComment} maxLength={120} multiline
                style={[{ minHeight: 76, borderRadius: 14, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.surface, padding: 12, fontFamily: fontFamily.regular, fontSize: 15, color: theme.text, textAlignVertical: 'top' }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
            </View>
          )}
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18, backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Stepper value={qty} min={1} max={20} onMinus={() => setQty((q) => Math.max(1, q - 1))} onPlus={() => setQty((q) => Math.min(20, q + 1))} />
        <View style={{ flex: 1 }}>
          <PressScale accessibilityRole="button" accessibilityLabel={ka.product.addFor} accessibilityState={{ disabled: sold }} disabled={sold} scaleTo={0.97}
            style={{ minHeight: 54, borderRadius: 27, backgroundColor: sold ? '#3A4A6B' : colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }} onPress={addToCart}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: sold ? theme.muted : colors.onBrand }}>{sold ? ka.menu.soldOut : 'კალათაში დამატება'}</Text>
            <Bump value={total}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: sold ? theme.muted : colors.onBrand }}>{formatGel(total)}</Text></Bump>
          </PressScale>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
