import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, ErrorText, FadeIn, Header, Screen, StateView } from '../src/components/ui';
import { PressScale } from '../src/components/fx';
import { Photo, Stepper } from '../src/components/product';
import { Icon } from '../src/components/Icon';
import { isExtraCategory, loadMenu, type Menu, type Product } from '../src/lib/menuData';
import { supabase } from '../src/lib/supabase';
import { usePromoSync, useCart } from '../src/state/cart';

export default function Cart() {
  const router = useRouter();
  const { lines, add, remove, clear, setLines, subtotal, promo, setPromo, branch } = useCart();
  const promoMsg = usePromoSync();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [tab, setTab] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => { if (branch) loadMenu(branch.id).then(setMenu).catch(() => undefined); }, [branch]);
  // prices in a stored cart may be old: show today's prices (the server uses them anyway)
  useEffect(() => {
    if (!menu) return;
    let changed = false;
    const next = lines.map((l) => { const p = menu.products.find((x) => x.id === l.productId); if (p && p.price_tetri !== l.unitPriceTetri) { changed = true; return { ...l, unitPriceTetri: p.price_tetri }; } return l; });
    if (changed) setLines(next);
  }, [menu]); // eslint-disable-line react-hooks/exhaustive-deps
  const isGone = (productId: string) => !!menu && !menu.products.some((p) => p.id === productId && p.available);
  const anyGone = lines.some((l) => isGone(l.productId));
  const imageOf = (productId: string) => menu?.products.find((p) => p.id === productId)?.image_path ?? null;

  const upsell = useMemo(() => {
    if (!menu) return [] as { id: string; name: string; items: Product[] }[];
    const inCart = new Set(lines.map((l) => l.productId));
    return menu.categories.filter(isExtraCategory)
      .map((c) => ({ id: c.id, name: c.name_ka, items: menu.products.filter((p) => p.category_id === c.id && p.available && !inCart.has(p.id)) }))
      .filter((g) => g.items.length > 0);
  }, [menu, lines]);
  const group = upsell.find((g) => g.id === tab) ?? upsell[0];

  async function applyCode() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('apply_promo', { p_code: c, p_subtotal: subtotal });
    setBusy(false);
    if (error) { setErr(errorText(error.message)); return; }
    setPromo({ code: c, discountTetri: Number(data) });
    setCode('');
  }

  const discount = promo?.discountTetri ?? 0;
  return (
    <Screen scroll>
      <Header back title={ka.cart.title} subtitle={lines.length > 0 ? `${lines.reduce((n, l) => n + l.quantity, 0)} ${ka.cart.items} · ${branch?.name ?? ''}` : undefined} right={lines.length > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => setConfirmClear(true)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.red }}>{ka.cart.clear}</Text>
        </Pressable>) : undefined} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        {confirmClear ? (
          <Card style={{ borderColor: colors.red, gap: 10 }}>
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: theme.text }}>{ka.cart.clear}?</Text>
            <Button title={ka.common.yes} onPress={() => { clear(); setConfirmClear(false); }} />
            <Button title={ka.common.no} variant="outline" onPress={() => setConfirmClear(false)} />
          </Card>
        ) : null}

        {lines.length === 0 && <StateView icon="bag" title={ka.cart.empty} hint={ka.cart.emptyHint} actionTitle={ka.orders.toMenu} onAction={() => router.replace('/home')} />}

        {lines.map((l, i) => (
          <FadeIn key={l.key} index={i}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, borderWidth: 0 }}>
              <Photo path={imageOf(l.productId)} style={{ width: 78, height: 78 }} rounded={14} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={2} style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{l.name}</Text>
                {isGone(l.productId) ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.red }}>{ka.menu.soldOut} · {ka.cart.removeIt}</Text> : null}
                {l.note ? <Text numberOfLines={3} style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{l.note}</Text> : null}
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>{formatGel(l.unitPriceTetri * l.quantity)}</Text>
              </View>
              <Stepper value={l.quantity} onMinus={() => remove(l.key)} onPlus={() => add({ productId: l.productId, name: l.name, unitPriceTetri: l.unitPriceTetri, note: l.note })} />
            </Card>
          </FadeIn>
        ))}

        {lines.length > 0 && upsell.length > 0 && group && (
          <View style={{ gap: 10, marginTop: 4 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{ka.cart.upsell}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {upsell.map((g) => {
                const on = g.id === group.id;
                return (
                  <Pressable key={g.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(g.id)}
                    style={{ minHeight: 40, paddingHorizontal: 16, borderRadius: 20, justifyContent: 'center', backgroundColor: on ? colors.brand : theme.surface }}>
                    <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: on ? colors.onBrand : theme.text }}>{g.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {group.items.map((p) => (
                <View key={p.id} style={{ width: 128, backgroundColor: theme.surface, borderRadius: 16, padding: 8, gap: 6 }}>
                  <Photo path={p.image_path} style={{ height: 78 }} rounded={12} />
                  <View style={{ gap: 2 }}>
                    <Text numberOfLines={2} style={{ fontFamily: fontFamily.semibold, fontSize: 12, color: theme.text, minHeight: 32 }}>{p.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>{formatGel(p.price_tetri)}</Text>
                      <PressScale accessibilityRole="button" accessibilityLabel={`${ka.menu.add}: ${p.name}`} onPress={() => add({ productId: p.id, name: p.name, unitPriceTetri: p.price_tetri })} scaleTo={0.8}
                        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="plus" size={18} color={colors.onBrand} strokeWidth={2.4} />
                      </PressScale>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {lines.length > 0 && (
          <>
            <View style={{ gap: 6, marginTop: 4 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.cart.promo}</Text>
              {promo ? (
                <Card selected style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon name="star" size={20} color={colors.brand} />
                  <Text style={{ flex: 1, fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{promo.code}  <Text style={{ color: colors.brand }}>−{formatGel(promo.discountTetri)}</Text></Text>
                  <Pressable accessibilityRole="button" onPress={() => setPromo(null)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.red }}>{ka.cart.promoRemove}</Text></Pressable>
                </Card>
              ) : (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput accessibilityLabel={ka.cart.promo} placeholder={ka.cart.promoPh} placeholderTextColor={theme.muted} value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} maxLength={30}
                    style={[{ flex: 1, minWidth: 0, minHeight: 48, borderRadius: 14, borderWidth: 2, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 14, fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
                  <PressScale accessibilityRole="button" onPress={applyCode} disabled={busy || !code.trim()} scaleTo={0.95}
                    style={{ minHeight: 48, paddingHorizontal: 18, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', opacity: busy || !code.trim() ? 0.5 : 1 }}>
                    <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.onBrand }}>{ka.cart.promoApply}</Text>
                  </PressScale>
                </View>
              )}
              {(err || promoMsg) ? <ErrorText>{err ?? promoMsg}</ErrorText> : null}
            </View>

            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Body muted>{ka.cart.subtotal}</Body><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{formatGel(subtotal)}</Text>
              </View>
              {discount > 0 ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body muted>{ka.cart.discount}</Body><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.brand }}>−{formatGel(discount)}</Text>
                </View>
              ) : null}
              <View style={{ height: 1, backgroundColor: theme.border }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text }}>{ka.checkout.total}</Text>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 22, color: theme.text }}>{formatGel(subtotal - discount)}</Text>
              </View>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{ka.checkout.deliveryAtCheckout}</Text>
            </Card>
            <Button title={`შეკვეთის გაფორმება · ${formatGel(subtotal - discount)}`} onPress={() => router.push('/checkout')} disabled={anyGone} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}
