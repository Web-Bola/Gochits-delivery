import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../src/components/Icon';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel, toOrderItems, type BranchOption } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, ErrorText, Header, Screen } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useDemoMode } from '../src/lib/demo';
import { registerForPush } from '../src/lib/push';
import { isNetworkError } from '../src/lib/net';
import { usePromoSync, useCart, type DeliveryAddress } from '../src/state/cart';

type Method = 'card' | 'cash';
interface PickupBranch { id: string; name: string; address: string | null; phone: string | null; accepts_orders: boolean; is_open: boolean; pickup_enabled: boolean; pickup_discount_percent: number }
interface AddrRow { id: string; street: string; entrance: string | null; floor: string | null; apartment: string | null; lat: number; lng: number }

// Card payment is a DEMO simulation (no card data, server flag app_settings.demo_mode). Real provider is undecided (D-PAY).
// Cash only if the branch has cod_enabled. The server re-checks everything (zone, minimum, fee, promo, hours); this screen only explains it.
export default function Checkout() {
  const router = useRouter();
  const demo = useDemoMode();
  const { lines, address, setAddress, branch, setBranch, subtotal, promo, setPromo, clear } = useCart();
  const promoMsg = usePromoSync();
  const [addrs, setAddrs] = useState<AddrRow[] | null>(null);
  const [options, setOptions] = useState<BranchOption[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<Method>('card');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickAddr, setPickAddr] = useState(false);
  const [tick, setTick] = useState(0);
  const [mode, setMode] = useState<'delivery' | 'pickup'>('delivery');
  const [minutes, setMinutes] = useState(0);
  const [pbranches, setPbranches] = useState<PickupBranch[] | null>(null);
  const pickup = mode === 'pickup';
  useFocusEffect(useCallback(() => { setTick((t) => t + 1); }, []));

  const loadAddrs = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('my_addresses');
    if (e) { setAddrs([]); setError(isNetworkError(e) ? ka.errors.network : ka.errors.generic); return; }
    setAddrs((data ?? []) as AddrRow[]);
  }, []);
  useFocusEffect(useCallback(() => { loadAddrs(); }, [loadAddrs]));

  // keep a valid selection: the one in memory if it still exists, otherwise the newest saved one
  useEffect(() => {
    if (!addrs) return;
    const keep = address && addrs.find((a) => a.id === address.id);
    if (keep) return;
    const first = addrs[0];
    setAddress(first ? { id: first.id, street: first.street, lat: first.lat, lng: first.lng, entrance: first.entrance, floor: first.floor, apartment: first.apartment } : null);
  }, [addrs, address, setAddress]);

  // which branches deliver to this address (server decides)
  useEffect(() => {
    if (!address) { setOptions(null); return; }
    let alive = true;
    setChecking(true);
    supabase.rpc('resolve_branches', { p_lat: address.lat, p_lng: address.lng }).then(({ data, error: e }) => {
      if (!alive) return;
      setChecking(false);
      if (e) { setOptions([]); setError(isNetworkError(e) ? ka.errors.network : ka.errors.generic); return; }
      setOptions((data ?? []) as BranchOption[]);
    });
    return () => { alive = false; };
  }, [address, tick]);

  useEffect(() => {
    if (!pickup) return;
    supabase.rpc('list_branches').then(({ data, error: e }) => { if (!e) setPbranches((data ?? []) as PickupBranch[]); });
  }, [pickup, tick]);
  const pb = pbranches?.find((b) => b.id === branch?.id) ?? null;
  const pickupDiscount = pickup && pb ? Math.floor((subtotal * pb.pickup_discount_percent) / 100) : 0;
  const pickupReady = !!pb && pb.accepts_orders && pb.pickup_enabled && pb.is_open;
  const here = options?.find((o) => o.branch_id === branch?.id) ?? null;
  const others = (options ?? []).filter((o) => o.can_order && o.branch_id !== branch?.id);
  const discount = promo?.discountTetri ?? 0;
  const fee = here?.fee_tetri == null ? null : here.free_from_tetri != null && subtotal >= here.free_from_tetri ? 0 : here.fee_tetri;
  const belowMin = here ? Math.max(0, here.min_order_tetri - subtotal) : 0;
  const untilFree = here && here.free_from_tetri != null && subtotal < here.free_from_tetri && here.fee_tetri ? here.free_from_tetri - subtotal : 0;
  const cashOk = pickup ? true : !!here?.cod_enabled;
  const cardOk = demo === true;
  const chosen: Method | null = method === 'card' ? (cardOk ? 'card' : cashOk ? 'cash' : null) : (cashOk ? 'cash' : cardOk ? 'card' : null);
  const deliverable = !!here && here.fee_tetri != null;
  const canPlace = pickup ? (pickupReady && !!chosen && lines.length > 0 && !busy) : (deliverable && belowMin === 0 && !!chosen && lines.length > 0 && !busy && !!address);

  async function place() {
    if (!branch || !chosen || !canPlace || (!pickup && !address)) return;
    setBusy(true); setError(null);
    const { data, error: e } = pickup
      ? await supabase.rpc('create_pickup_order', {
          p_branch_id: branch.id, p_items: toOrderItems(lines), p_payment_method: chosen,
          p_notes: notes.trim() || null, p_promo: promo?.code ?? null, p_pickup_minutes: minutes,
        })
      : await supabase.rpc('create_order', {
          p_branch_id: branch.id, p_address_id: address!.id, p_items: toOrderItems(lines),
          p_payment_method: chosen, p_notes: notes.trim() || null, p_promo: promo?.code ?? null,
        });
    setBusy(false);
    if (e) {
      console.warn('create_order failed', e);
      if (/^promo_/.test(e.message)) setPromo(null);
      setError(isNetworkError(e) ? ka.errors.network : errorText(e.message));
      return;
    }
    clear();
    registerForPush(true).catch(() => undefined);
    if (chosen === 'card') router.replace({ pathname: '/payment', params: { id: String(data) } });
    else router.replace({ pathname: '/order/[id]', params: { id: String(data) } });
  }

  const row = (k: string, v: string, big?: boolean, accent?: boolean) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Body muted>{k}</Body><Text style={{ fontFamily: fontFamily.extrabold, fontSize: big ? 18 : 14, color: big || accent ? colors.brand : theme.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );

  const detail = (a: Pick<AddrRow, 'entrance' | 'floor' | 'apartment'>) => [a.entrance && `${ka.address.entrance} ${a.entrance}`, a.floor && `${ka.address.floor} ${a.floor}`, a.apartment && `${ka.address.apartment} ${a.apartment}`].filter(Boolean).join(' · ');
  const addrKey = (a: { street: string; entrance?: string | null; floor?: string | null; apartment?: string | null; lat: number; lng: number }) => `${a.street}|${a.entrance}|${a.floor}|${a.apartment}|${a.lat.toFixed(5)}|${a.lng.toFixed(5)}`;
  const uniqueAddrs = (addrs ?? []).filter((a, i, arr) => arr.findIndex((b) => addrKey(b) === addrKey(a)) === i);
  const status = useMemo(() => {
    if (!address) return null;
    if (checking || !options) return { tone: 'muted' as const, text: ka.checkout.checking };
    if (!here) return { tone: 'bad' as const, text: others.length ? ka.checkout.otherBranch : ka.checkout.outside };
    return { tone: 'ok' as const, text: `${ka.checkout.ok} · +${here.extra_minutes} ${'წთ'}` };
  }, [address, checking, options, here, others.length]);

  const picked = uniqueAddrs.find((a) => address?.id === a.id || (!!address && addrKey(address) === addrKey(a))) ?? null;
  const showList = pickAddr || !picked;
  const eta = here ? 25 + here.extra_minutes : null;
  const tone = status?.tone;
  const toneColor = tone === 'bad' ? '#D63A2F' : tone === 'ok' ? '#1E8E5A' : theme.muted;

  const sectionTitle = (n: number, t: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.onBrand }}>{n}</Text>
      </View>
      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{t}</Text>
    </View>
  );
  const tile = (m: Method, icon: string, title: string, enabled: boolean, hint?: string) => {
    const on = chosen === m;
    return (
      <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !enabled }} disabled={!enabled} onPress={() => setMethod(m)}
        style={{ flex: 1, minHeight: 112, borderRadius: 18, padding: 14, gap: 8, backgroundColor: on ? 'rgba(14,107,87,0.08)' : theme.surface, borderWidth: 2, borderColor: on ? colors.brand : 'transparent', opacity: enabled ? 1 : 0.4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Icon name={icon} size={26} color={colors.brand} />
          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: on ? colors.brand : theme.border, alignItems: 'center', justifyContent: 'center' }}>
            {on && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.brand }} />}
          </View>
        </View>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{title}</Text>
        {hint ? <Text numberOfLines={3} style={{ fontFamily: fontFamily.regular, fontSize: 11.5, color: theme.muted, lineHeight: 16 }}>{hint}</Text> : null}
      </Pressable>
    );
  };

  return (
    <Screen scroll>
      <Header back title={ka.checkout.title} subtitle={branch?.name} right={
        <Pressable accessibilityRole="button" onPress={() => router.push('/branches')} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.brand }}>{ka.checkout.changeBranch}</Text>
        </Pressable>} />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 24 }}>

        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', backgroundColor: theme.surface, borderRadius: 18, padding: 4, gap: 4 }}>
          {([['delivery', 'მიტანა', 'bike'], ['pickup', 'თვითონ წამოვიღებ', 'bag']] as const).map(([m, t, ic]) => {
            const on = mode === m;
            return (
              <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => { setMode(m); setError(null); }}
                style={{ flex: 1, minHeight: 48, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.brand : 'transparent' }}>
                <Icon name={ic} size={18} color={on ? colors.onBrand : theme.muted} />
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: on ? colors.onBrand : theme.text }}>{t}</Text>
              </Pressable>
            );
          })}
        </View>

        {pickup ? (
          <>
            {sectionTitle(1, 'ფილიალი და დრო')}
            <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 14, gap: 12 }}>
              {!branch ? (
                <Pressable accessibilityRole="button" onPress={() => router.push('/branches')} style={{ minHeight: 48, borderRadius: 24, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.onBrand }}>აირჩიე ფილიალი</Text>
                </Pressable>
              ) : (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(14,107,87,0.12)', alignItems: 'center', justifyContent: 'center' }}><Icon name="pin" size={22} color={colors.brand} /></View>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{branch.name}</Text>
                      {pb?.address ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12.5, color: theme.muted }}>{pb.address}</Text> : null}
                    </View>
                    <Pressable accessibilityRole="button" onPress={() => router.push('/branches')} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.brand }}>{ka.branch.change}</Text></Pressable>
                  </View>
                  {pb && !pickupReady ? (
                    <View style={{ backgroundColor: 'rgba(232,85,61,0.12)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}>
                      <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: theme.text }}>{!pb.pickup_enabled ? 'ამ ფილიალში თვითონ წამოღება ამჟამად გამორთულია' : !pb.is_open ? 'ფილიალი ახლა დახურულია' : 'ფილიალი ახლა შეკვეთებს არ იღებს'}</Text>
                    </View>
                  ) : null}
                  {pb && pb.pickup_discount_percent > 0 ? (
                    <View style={{ backgroundColor: 'rgba(30,142,90,0.1)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}>
                      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: '#1E8E5A' }}>თვითონ წამოღებაზე −{pb.pickup_discount_percent}%</Text>
                    </View>
                  ) : null}
                  <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: theme.muted }}>როდის მოხვალ?</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {[[0, 'რაც შეიძლება მალე'], [15, '15 წთ-ში'], [30, '30 წთ-ში'], [45, '45 წთ-ში'], [60, '1 საათში']].map(([v, t]) => {
                      const on = minutes === v;
                      return (
                        <Pressable key={String(v)} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setMinutes(v as number)}
                          style={{ minHeight: 40, borderRadius: 20, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: on ? colors.brand : theme.surface2 }}>
                          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: on ? colors.onBrand : theme.text }}>{t}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          </>
        ) : null}

        {!pickup ? sectionTitle(1, ka.checkout.addressTitle) : null}
        {!pickup && (!addrs ? <ActivityIndicator color={colors.brand} /> : (
          <>
            {picked && !showList ? (
              <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 14, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(14,107,87,0.12)', alignItems: 'center', justifyContent: 'center' }}><Icon name="pin" size={22} color={colors.brand} /></View>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{picked.street}</Text>
                    {detail(picked) ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12.5, color: theme.muted }}>{detail(picked)}</Text> : null}
                  </View>
                  {<Pressable accessibilityRole="button" onPress={() => setPickAddr(true)} style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.brand }}>{ka.branch.change}</Text></Pressable>}
                </View>
                {status ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: tone === 'bad' ? 'rgba(232,85,61,0.12)' : tone === 'ok' ? 'rgba(30,142,90,0.1)' : theme.surface2, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 }}>
                    <Icon name={tone === 'bad' ? 'x' : tone === 'ok' ? 'check' : 'clock'} size={17} color={toneColor} strokeWidth={2.4} />
                    <Text style={{ flex: 1, fontFamily: fontFamily.semibold, fontSize: 13, color: theme.text, lineHeight: 18 }}>{status.text}</Text>
                  </View>
                ) : null}
                {tone === 'bad' && !here ? others.map((o) => (
                  <Pressable key={o.branch_id} accessibilityRole="button" onPress={() => setBranch({ id: o.branch_id, name: o.branch_name })}
                    style={{ minHeight: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 }}>
                    <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.onBrand }}>{ka.checkout.switchTo}: {o.branch_name}</Text>
                  </Pressable>
                )) : null}
                {here && eta ? (
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface2, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 6 }}><Icon name="clock" size={14} color={colors.brand} /><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: theme.text }}>~{eta} წთ</Text></View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface2, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 6 }}><Icon name="bike" size={14} color={colors.brand} /><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: theme.text }}>{fee === null ? '—' : fee === 0 ? '0.00 ₾' : formatGel(fee)}</Text></View>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                {uniqueAddrs.length === 0 ? <Body muted>{ka.checkout.noAddress}</Body> : null}
                {uniqueAddrs.map((a) => {
                  const on = !!picked && picked.id === a.id;
                  return (
                    <Pressable key={a.id} accessibilityRole="radio" accessibilityState={{ selected: on }}
                      onPress={() => { setAddress({ id: a.id, street: a.street, lat: a.lat, lng: a.lng, entrance: a.entrance, floor: a.floor, apartment: a.apartment } satisfies DeliveryAddress); setPickAddr(false); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: 16, padding: 14, borderWidth: 2, borderColor: on ? colors.brand : 'transparent' }}>
                      <Icon name="pin" size={20} color={on ? colors.brand : theme.muted} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={2} style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>{a.street}</Text>
                        {detail(a) ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{detail(a)}</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable accessibilityRole="button" onPress={() => router.push('/address')} style={{ minHeight: 48, borderRadius: 16, borderWidth: 2, borderColor: theme.border, borderStyle: 'dashed', flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="plus" size={18} color={colors.brand} /><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>{ka.checkout.addAddress}</Text>
                </Pressable>
              </View>
            )}
          </>
        ))}

        {sectionTitle(2, ka.checkout.payment)}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {tile('card', 'card', ka.checkout.card, cardOk, cardOk ? ka.payment.note : ka.payment.demoOff)}
          {tile('cash', 'cash', pickup ? 'ადგილზე' : ka.checkout.cash, cashOk, pickup ? 'გადაიხდი ფილიალში' : cashOk ? undefined : ka.checkout.cashOff)}
        </View>

        {sectionTitle(3, ka.checkout.notes)}
        <TextInput accessibilityLabel={ka.checkout.notes} value={notes} onChangeText={setNotes} multiline maxLength={300} placeholder="…" placeholderTextColor={theme.muted}
          style={[{ minHeight: 76, borderRadius: 16, backgroundColor: theme.surface, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12, fontFamily: fontFamily.regular, fontSize: 14, color: theme.text, textAlignVertical: 'top' }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />

        {sectionTitle(4, ka.checkout.yourOrder)}
        <View style={{ backgroundColor: theme.surface, borderRadius: 18, padding: 16, gap: 8 }}>
          {lines.map((l) => (
            <View key={l.key} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
              <Text numberOfLines={2} style={{ flex: 1, fontFamily: fontFamily.regular, fontSize: 14, color: theme.text }}>{l.quantity}× {l.name}</Text>
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: theme.text }}>{formatGel(l.unitPriceTetri * l.quantity)}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 4 }} />
          {row(ka.cart.subtotal, formatGel(subtotal))}
          {discount > 0 ? row(`${ka.cart.discount} ${promo?.code ?? ''}`, `−${formatGel(discount)}`, false, true) : null}
          {pickupDiscount > 0 ? row(`თვითონ წამოღება −${pb?.pickup_discount_percent}%`, `−${formatGel(pickupDiscount)}`, false, true) : null}
          {pickup ? null : row(ka.checkout.delivery, fee === null ? '—' : fee === 0 ? formatGel(0) : formatGel(fee))}
          {!pickup && belowMin > 0 ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: '#D63A2F' }}>{ka.checkout.minLeft} {formatGel(belowMin)}</Text> : null}
          {!pickup && untilFree > 0 ? <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12, color: colors.brand }}>{ka.checkout.freeFrom} {formatGel(untilFree)}</Text> : null}
        </View>
        {(error || promoMsg) && <ErrorText>{error ?? promoMsg}</ErrorText>}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 10, backgroundColor: theme.bg, borderTopWidth: 1, borderTopColor: theme.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: theme.muted }}>{ka.checkout.total}</Text>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 22, color: theme.text }}>{formatGel(Math.max(0, subtotal - discount - pickupDiscount) + (pickup ? 0 : (fee ?? 0)))}</Text>
        </View>
        <Button title={busy ? '...' : chosen === 'card' ? ka.checkout.pay : ka.checkout.place} onPress={place} disabled={!canPlace} />
      </View>
    </Screen>
  );
}
