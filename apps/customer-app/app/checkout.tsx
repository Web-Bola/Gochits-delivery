import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel, toOrderItems, type BranchOption } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, ErrorText, Field, Header, Screen } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useDemoMode } from '../src/lib/demo';
import { registerForPush } from '../src/lib/push';
import { isNetworkError } from '../src/lib/net';
import { usePromoSync, useCart, type DeliveryAddress } from '../src/state/cart';

type Method = 'card' | 'cash';
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
  }, [address]);

  const here = options?.find((o) => o.branch_id === branch?.id) ?? null;
  const others = (options ?? []).filter((o) => o.can_order && o.branch_id !== branch?.id);
  const discount = promo?.discountTetri ?? 0;
  const fee = here?.fee_tetri == null ? null : here.free_from_tetri != null && subtotal >= here.free_from_tetri ? 0 : here.fee_tetri;
  const belowMin = here ? Math.max(0, here.min_order_tetri - subtotal) : 0;
  const untilFree = here && here.free_from_tetri != null && subtotal < here.free_from_tetri && here.fee_tetri ? here.free_from_tetri - subtotal : 0;
  const cashOk = !!here?.cod_enabled;
  const cardOk = demo === true;
  const chosen: Method | null = method === 'card' ? (cardOk ? 'card' : cashOk ? 'cash' : null) : (cashOk ? 'cash' : cardOk ? 'card' : null);
  const deliverable = !!here && here.can_order;
  const canPlace = deliverable && belowMin === 0 && !!chosen && lines.length > 0 && !busy && !!address;

  async function place() {
    if (!branch || !address || !chosen || !canPlace) return;
    setBusy(true); setError(null);
    const { data, error: e } = await supabase.rpc('create_order', {
      p_branch_id: branch.id, p_address_id: address.id, p_items: toOrderItems(lines),
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
      <Body muted>{k}</Body><Text style={{ fontFamily: fontFamily.extrabold, fontSize: big ? 18 : 14, color: big || accent ? colors.yellow : theme.text, flexShrink: 1, textAlign: 'right' }}>{v}</Text>
    </View>
  );

  const option = (m: Method, icon: string, title: string, enabled: boolean, hint?: string) => {
    const on = chosen === m;
    return (
      <Pressable key={m} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !enabled }} disabled={!enabled} onPress={() => setMethod(m)}>
        <Card selected={on} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: enabled ? 1 : 0.45 }}>
          <Text style={{ fontSize: 26 }}>{icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{title}</Text>
            {hint ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{hint}</Text> : null}
          </View>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? colors.yellow : theme.border, alignItems: 'center', justifyContent: 'center' }}>
            {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.yellow }} />}
          </View>
        </Card>
      </Pressable>
    );
  };

  const detail = (a: Pick<AddrRow, 'entrance' | 'floor' | 'apartment'>) => [a.entrance && `${ka.address.entrance} ${a.entrance}`, a.floor && `${ka.address.floor} ${a.floor}`, a.apartment && `${ka.address.apartment} ${a.apartment}`].filter(Boolean).join(' · ');
  const status = useMemo(() => {
    if (!address) return null;
    if (checking || !options) return { tone: 'muted' as const, text: ka.checkout.checking };
    if (!here) return { tone: 'bad' as const, text: others.length ? ka.checkout.otherBranch : ka.checkout.outside };
    if (!here.is_open) return { tone: 'bad' as const, text: ka.checkout.branchClosed };
    if (!here.can_order) return { tone: 'bad' as const, text: ka.branch.notAccepting };
    return { tone: 'ok' as const, text: `${ka.checkout.ok} · +${here.extra_minutes} ${'წთ'}` };
  }, [address, checking, options, here, others.length]);

  return (
    <Screen scroll>
      <Header back title={ka.checkout.title} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card>{row(ka.checkout.branch, branch?.name ?? '')}
          <Pressable accessibilityRole="button" onPress={() => router.push('/branches')} style={{ minHeight: 36, justifyContent: 'center' }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.yellow }}>{ka.branch.change}</Text></Pressable>
        </Card>

        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text }}>{ka.checkout.addressTitle}</Text>
        {!addrs ? <ActivityIndicator color={colors.yellow} /> : (
          <>
            {addrs.length === 0 && <Body muted>{ka.checkout.noAddress}</Body>}
            {addrs.map((a) => {
              const on = address?.id === a.id;
              const d = detail(a);
              return (
                <Pressable key={a.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => setAddress({ id: a.id, street: a.street, lat: a.lat, lng: a.lng, entrance: a.entrance, floor: a.floor, apartment: a.apartment } satisfies DeliveryAddress)}>
                  <Card selected={on} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 22 }}>📍</Text>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={2} style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>{a.street}</Text>
                      {d ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{d}</Text> : null}
                    </View>
                    <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? colors.yellow : theme.border, alignItems: 'center', justifyContent: 'center' }}>
                      {on && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.yellow }} />}
                    </View>
                  </Card>
                </Pressable>
              );
            })}
            <Button variant="outline" title={`+ ${ka.checkout.addAddress}`} onPress={() => router.push('/address')} />
          </>
        )}

        {status ? (
          <Card style={{ borderColor: status.tone === 'bad' ? colors.red : status.tone === 'ok' ? '#2E7D4F' : theme.border, gap: 8 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>{status.tone === 'ok' ? '✓ ' : status.tone === 'bad' ? '⚠ ' : ''}{status.text}</Text>
            {status.tone === 'bad' && !here && others.map((o) => (
              <Button key={o.branch_id} variant="ink" title={`${ka.checkout.switchTo}: ${o.branch_name}`} onPress={() => setBranch({ id: o.branch_id, name: o.branch_name })} />
            ))}
          </Card>
        ) : null}

        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text }}>{ka.checkout.payment}</Text>
        {option('card', '💳', ka.checkout.card, cardOk, cardOk ? ka.payment.note : ka.payment.demoOff)}
        {option('cash', '💵', ka.checkout.cash, cashOk, cashOk ? undefined : ka.checkout.cashOff)}
        <Field label={ka.checkout.notes} value={notes} onChangeText={setNotes} multiline maxLength={300} />

        <Card>
          {row(ka.cart.subtotal, formatGel(subtotal))}
          {discount > 0 ? row(`${ka.cart.discount} ${promo?.code ?? ''}`, `−${formatGel(discount)}`, false, true) : null}
          {row(ka.checkout.delivery, fee === null ? '—' : fee === 0 ? '0.00 ₾' : formatGel(fee))}
          {row(ka.checkout.total, fee === null ? formatGel(subtotal - discount) : formatGel(subtotal - discount + fee), true)}
          {belowMin > 0 ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.red }}>{ka.checkout.minLeft} {formatGel(belowMin)}</Text> : null}
          {untilFree > 0 ? <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12, color: colors.yellow }}>{ka.checkout.freeFrom} {formatGel(untilFree)}</Text> : null}
          <Body muted>{ka.checkout.deliveryServer}</Body>
        </Card>
        {(error || promoMsg) && <ErrorText>{error ?? promoMsg}</ErrorText>}
        <Button title={busy ? '...' : chosen === 'card' ? ka.checkout.pay : ka.checkout.place} onPress={place} disabled={!canPlace} />
      </ScrollView>
    </Screen>
  );
}
