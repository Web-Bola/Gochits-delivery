import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatGel, TERMINAL_STATUSES, type OrderStatus } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { BackButton, Button, ErrorText, Screen, StateView } from '../../src/components/ui';
import { Bump, Confetti, PressScale } from '../../src/components/fx';
import { Icon } from '../../src/components/Icon';
import { TrackScene } from '../../src/components/TrackScene';
import { supabase } from '../../src/lib/supabase';
import { useDemoMode } from '../../src/lib/demo';
import { useReorder } from '../../src/lib/reorder';
import { STATUS_LABEL } from '../../src/lib/status';

const SCENE_OF: Partial<Record<OrderStatus, string>> = { placed: 'shop', accepted: 'shop', preparing: 'cook', ready_for_pickup: 'cook', out_for_delivery: 'ride', delivered: 'home' };
const HEAD_OF: Partial<Record<OrderStatus, [string, string]>> = {
  placed: ['შეკვეთა გაიგზავნა', 'ფილიალი ამოწმებს შეკვეთას'], accepted: ['ფილიალმა მიიღო', 'ცოტა ხანში დაიწყებენ მომზადებას'], preparing: ['მზადდება', 'შენი შეკვეთა ახლა მზადდება'],
  ready_for_pickup: ['მზადაა', 'კურიერს ელოდება'], out_for_delivery: ['კურიერი გზაშია', 'მალე შენთან იქნება'], delivered: ['მიტანილია!', 'ისიამოვნე კერძით'],
};
const STEP_OF: Partial<Record<OrderStatus, number>> = { placed: 0, accepted: 0, preparing: 1, ready_for_pickup: 1, out_for_delivery: 2, delivered: 3 };
const TK = [['receipt', 'მიღებულია'], ['flame', 'მზადდება'], ['bike', 'გზაში'], ['home', 'მიტანილია']] as const;
const TK_PICKUP = [['receipt', 'მიღებულია'], ['flame', 'მზადდება'], ['bag', 'მზადაა'], ['check', 'გაიცა']] as const;
const STEP_PICKUP: Partial<Record<OrderStatus, number>> = { placed: 0, accepted: 0, preparing: 1, ready_for_pickup: 2, delivered: 3 };
const HEAD_PICKUP: Partial<Record<OrderStatus, [string, string]>> = { ready_for_pickup: ['მზადაა, მოდი აიღე!', 'შენი შეკვეთა ფილიალში გელოდება'], delivered: ['გაიცა!', 'ისიამოვნე კერძით'] };
const INK = colors.ink;

interface Item { product_id: string; name_snapshot: string; quantity: number; unit_price_tetri: number; note: string | null }
interface Row {
  created_at: string; number: string; status: OrderStatus; total_tetri: number; subtotal_tetri: number; delivery_fee_tetri: number; discount_tetri: number; promo_code: string | null;
  payment_method: 'card' | 'cash'; payment_status: string; notes: string | null; order_items: Item[]; branches: { name: string; phone: string | null; address: string | null } | null; fulfillment: 'delivery' | 'pickup'; pickup_minutes: number | null;
}

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const demo = useDemoMode();
  const reorder = useReorder();
  const [row, setRow] = useState<Row | null>(null);
  const [failed, setFailed] = useState(false);
  const [auto, setAuto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [rated, setRated] = useState(false);
  const [dev, setDev] = useState(false); // test panel: long-press the order number (works only while the server's test switch is on)

  const load = useCallback(async () => {
    const [o, r] = await Promise.all([
      supabase.from('orders').select('created_at,number,status,total_tetri,subtotal_tetri,delivery_fee_tetri,discount_tetri,promo_code,payment_method,payment_status,notes,fulfillment,pickup_minutes,order_items(product_id,name_snapshot,quantity,unit_price_tetri,note),branches(name,phone,address)').eq('id', id).single(),
      supabase.from('order_ratings').select('stars').eq('order_id', id).maybeSingle(),
    ]);
    if (o.error || !o.data) { if (!row) setFailed(true); return; }
    setFailed(false); setRow(o.data as unknown as Row);
    const st = (r.data as { stars: number } | null)?.stars;
    if (st) { setRated(true); setStars(st); }
  }, [id, row]);

  useEffect(() => {
    load();
    // Realtime + 4 s polling fallback. RLS limits both to the customer's own order.
    const ch = supabase.channel(`order:${id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` }, () => { load(); }).subscribe();
    const poll = setInterval(load, 4000);
    return () => { clearInterval(poll); supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const advance = useCallback(async () => {
    setBusy(true);
    await supabase.rpc('demo_advance_order', { p_order_id: id });
    await load();
    setBusy(false);
  }, [id, load]);

  const finished = !!row && TERMINAL_STATUSES.includes(row.status);
  useEffect(() => {
    if (!auto || finished) return;
    const t = setTimeout(advance, 4500);
    return () => clearTimeout(t);
  }, [auto, finished, advance, row?.status]);

  async function cancel() {
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc('cancel_my_order', { p_order_id: id });
    setBusy(false); setConfirmCancel(false);
    if (e) { setError(errorText(e.message)); return; }
    await load();
  }
  async function sendRating() {
    if (stars < 1) return;
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc('rate_order', { p_order_id: id, p_stars: stars, p_comment: comment.trim() || null });
    setBusy(false);
    if (e) { setError(errorText(e.message)); return; }
    setRated(true);
  }
  async function again() {
    setBusy(true);
    try { await reorder(String(id)); router.replace('/cart'); } catch { setError(ka.errors.generic); } finally { setBusy(false); }
  }

  if (failed) return <Screen><BackButton onPress={() => router.replace('/orders')} /><StateView tone="error" icon="clock" title={ka.order.loadFail} hint={ka.errors.network} actionTitle={ka.common.retry} onAction={load} /></Screen>;
  if (!row) return <Screen><ActivityIndicator color={colors.yellow} /></Screen>;

  const pk = row.fulfillment === 'pickup';
  const TKS = pk ? TK_PICKUP : TK;
  const stepIdx = (pk ? STEP_PICKUP : STEP_OF)[row.status];
  const fin = row.status === 'delivered';
  const bad = row.status === 'payment_failed' || row.status === 'cancelled' || row.status === 'rejected';
  const canCancel = row.status === 'pending_payment' || (row.status === 'placed' && row.payment_status !== 'paid');
  const phone = row.branches?.phone ?? null;
  const [h1, h2] = (pk ? HEAD_PICKUP[row.status] : undefined) ?? HEAD_OF[row.status] ?? [STATUS_LABEL[row.status], ''];
  const scene = (pk && row.status === 'ready_for_pickup') ? 'shop' : (SCENE_OF[row.status] ?? 'shop');
  const out = !pk && row.status === 'out_for_delivery';
  const card = { backgroundColor: theme.surface, borderRadius: 18, padding: 14, gap: 9 } as const;
  const mins = Math.max(0, Math.round((Date.now() - new Date(row.created_at).getTime()) / 60000));
  const sentAgo = mins < 1 ? 'ახლახან გაიგზავნა' : mins < 60 ? `გაიგზავნა ${mins} წთ-ის წინ` : null;
  const muted = { fontFamily: fontFamily.regular, fontSize: 13, color: theme.muted } as const;

  return (
    <View style={{ flex: 1, backgroundColor: colors.yellow }}>
      <View>
        <View style={{ position: 'absolute', left: 16, right: 16, top: 16, zIndex: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <BackButton onPress={() => router.replace('/orders')} />
          <Pressable accessibilityRole="text" delayLongPress={900} onLongPress={() => setDev((d) => !d)} style={{ backgroundColor: 'rgba(26,13,11,0.88)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 }}><Text style={{ color: colors.yellow, fontFamily: fontFamily.extrabold, fontSize: 12 }}>№{row.number}</Text></Pressable>
        </View>
        <TrackScene scene={scene} />
        <View style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 38 }}>
          <Bump value={row.status}><Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 27, color: INK }}>{h1}</Text></Bump>
          {h2 ? <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: INK }}>{h2}</Text> : null}
        </View>
      </View>
      <View style={{ flex: 1, marginTop: -22, backgroundColor: theme.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!finished && sentAgo ? <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: theme.muted }}>{sentAgo} · განახლდება ავტომატურად</Text> : null}
          {bad ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: colors.red }}>{STATUS_LABEL[row.status]}</Text> : null}

          {stepIdx !== undefined && (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              {TKS.map(([ic, label], k) => {
                const done = k < stepIdx || fin; const act = k === stepIdx && !fin;
                return [
                  <View key={label} style={{ alignItems: 'center', gap: 6, width: 62 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? colors.yellow : theme.surface, borderWidth: 2, borderColor: done || act ? colors.yellow : theme.border }}>
                      <Icon name={done ? 'check' : ic} size={20} color={done ? INK : act ? colors.yellow : theme.muted} strokeWidth={done ? 3 : 2} />
                    </View>
                    <Text style={{ fontFamily: fontFamily.semibold, fontSize: 11, color: done ? theme.text : act ? colors.yellow : theme.muted }}>{label}</Text>
                  </View>,
                  k < 3 ? <View key={`${label}-l`} style={{ flex: 1, height: 4, borderRadius: 2, marginTop: 20, backgroundColor: k < stepIdx || fin ? colors.yellow : theme.border }} /> : null,
                ];
              })}
            </View>
          )}

          {pk && row.status === 'ready_for_pickup' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(61,220,132,0.1)', borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: '#3DDC84' }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' }}><Icon name="pin" size={22} color={INK} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>აიღე აქ: {row.branches?.name}</Text>
                {row.branches?.address ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 13, color: theme.muted }}>{row.branches.address}</Text> : null}
                <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12, color: theme.muted, marginTop: 2 }}>დაასახელე შეკვეთის ნომერი: №{row.number}</Text>
              </View>
            </View>
          ) : null}
          {pk && !finished && row.status !== 'ready_for_pickup' && row.status !== 'pending_payment' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: 18, padding: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' }}><Icon name="bag" size={22} color={INK} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>თვითონ წამოღება{row.pickup_minutes ? ` · ~${row.pickup_minutes} წთ-ში` : ''}</Text>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{row.branches?.name}{row.branches?.address ? `, ${row.branches.address}` : ''}</Text>
              </View>
            </View>
          ) : null}
          {!pk && (out || fin || row.status === 'ready_for_pickup') ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: 18, padding: 12 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' }}><Icon name={out || fin ? 'bike' : 'bag'} size={22} color={INK} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{out ? ka.order.courier : fin ? ka.order.delivered : STATUS_LABEL.ready_for_pickup}</Text>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{ka.order.courierHint}</Text>
              </View>
            </View>
          ) : null}

          {phone && !finished ? (
            <PressScale accessibilityRole="button" accessibilityLabel={ka.order.callBranch} onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => undefined)} scaleTo={0.97}
              style={{ minHeight: 48, borderRadius: 24, borderWidth: 1.5, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="phone" size={18} color={colors.yellow} /><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>{ka.order.callBranch}</Text>
            </PressScale>
          ) : null}

          {fin && (
            <View style={{ alignItems: 'center', gap: 8, backgroundColor: theme.surface, borderRadius: 18, padding: 14 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{rated ? ka.order.rated : ka.order.rateTitle}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <PressScale key={n} accessibilityRole="button" accessibilityLabel={`${n}`} disabled={rated} onPress={() => setStars(n)} scaleTo={0.8}>
                    <Icon name="star" size={34} color={n <= stars ? colors.yellow : '#5A4A43'} fill={n <= stars ? colors.yellow : '#5A4A43'} strokeWidth={1} />
                  </PressScale>
                ))}
              </View>
              {!rated && stars > 0 && (
                <View style={{ gap: 10, alignSelf: 'stretch' }}>
                  <TextInput accessibilityLabel={ka.order.rateHint} placeholder={ka.order.rateHint} placeholderTextColor={theme.muted} value={comment} onChangeText={setComment} maxLength={500} multiline
                    style={[{ minHeight: 60, borderRadius: 14, borderWidth: 1.5, borderColor: theme.border, backgroundColor: theme.bg, padding: 12, fontFamily: fontFamily.regular, fontSize: 14, color: theme.text, textAlignVertical: 'top' }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
                  <Button title={busy ? '...' : ka.order.rateSend} onPress={sendRating} disabled={busy} variant="red" />
                </View>
              )}
            </View>
          )}

          <View style={card}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.order.items}</Text>
            {row.order_items.map((it, i) => (
              <View key={i} style={{ gap: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={[muted, { flex: 1 }]}>{it.name_snapshot}</Text>
                  <Text style={muted}>× {it.quantity}</Text>
                </View>
                {it.note ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: colors.yellow }}>{it.note}</Text> : null}
              </View>
            ))}
            {row.notes ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{ka.order.notePrefix}: {row.notes}</Text> : null}
            {[[ka.cart.subtotal, formatGel(row.subtotal_tetri)], ...(row.discount_tetri > 0 ? [[`${ka.order.discount}${row.promo_code ? ` ${row.promo_code}` : ''}`, `−${formatGel(row.discount_tetri)}`]] : []), ...(pk ? [] : [[ka.order.delivery, formatGel(row.delivery_fee_tetri)]]), [ka.order.method, row.payment_method === 'card' ? ka.checkout.card : ka.checkout.cash]].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={muted}>{k}</Text><Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: theme.text }}>{v}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: theme.border, borderStyle: 'dashed', paddingTop: 10 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{ka.order.total}</Text>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 19, color: theme.text }}>{formatGel(row.total_tetri)}</Text>
            </View>
          </View>

          {demo && dev && !finished && row.status !== 'pending_payment' && (
            <View style={{ gap: 10, backgroundColor: theme.surface, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.yellow, letterSpacing: 0.5 }}>{ka.order.demoBanner}</Text>
              <Button variant="ink" title={busy ? '...' : ka.order.demoNext} onPress={advance} disabled={busy} />
              <Button variant="outline" title={auto ? ka.order.demoStop : ka.order.demoAuto} onPress={() => setAuto((a) => !a)} />
            </View>
          )}

          {error ? <ErrorText>{error}</ErrorText> : null}
          {canCancel && !confirmCancel ? <Button variant="outline" title={ka.order.cancel} onPress={() => setConfirmCancel(true)} /> : null}
          {confirmCancel ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>{ka.order.cancelConfirm}</Text>
              <Button title={busy ? '...' : ka.order.cancelYes} onPress={cancel} disabled={busy} />
              <Button variant="outline" title={ka.order.cancelNo} onPress={() => setConfirmCancel(false)} />
            </View>
          ) : null}
          {!canCancel && !finished && row.status !== 'pending_payment' ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{ka.order.cannotCancel}</Text> : null}
          {finished ? <Button title={ka.orders.reorder} onPress={again} disabled={busy} variant="red" /> : null}
          <Button variant={fin ? 'red' : 'outline'} title={fin ? ka.order.newOrder : ka.order.back} onPress={() => router.replace('/menu')} />
        </ScrollView>
      </View>
      {fin && <Confetti />}
    </View>
  );
}
