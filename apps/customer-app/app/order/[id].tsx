import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { formatGel, TERMINAL_STATUSES, type OrderStatus } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { colors, fontFamily } from '@gochits/ui-tokens';
import { BackButton, Button, ErrorText, FadeIn, Screen } from '../../src/components/ui';
import { Bump, Confetti, PressScale } from '../../src/components/fx';
import { TrackMap } from '../../src/components/TrackMap';
import { supabase } from '../../src/lib/supabase';
import { useDemoMode } from '../../src/lib/demo';
import { useReorder } from '../../src/lib/reorder';
import { STATUS_LABEL } from '../../src/lib/status';

const STEPS: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered'];
const LINES = ['შეკვეთა მიღებულია', 'რესტორანმა დაადასტურა', 'მზადდება', 'კურიერი გზაშია', 'მიტანილია'];
const LINE_OF: Partial<Record<OrderStatus, number>> = { placed: 0, accepted: 1, preparing: 2, ready_for_pickup: 2, out_for_delivery: 3, delivered: 4 };
const INK = colors.ink;
const MUTED = '#6b5a52';

interface Item { product_id: string; name_snapshot: string; quantity: number; unit_price_tetri: number; note: string | null }
interface Row {
  number: string; status: OrderStatus; total_tetri: number; subtotal_tetri: number; delivery_fee_tetri: number; discount_tetri: number; promo_code: string | null;
  payment_method: 'card' | 'cash'; payment_status: string; notes: string | null; order_items: Item[]; branches: { name: string; phone: string | null } | null;
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

  const load = useCallback(async () => {
    const [o, r] = await Promise.all([
      supabase.from('orders').select('number,status,total_tetri,subtotal_tetri,delivery_fee_tetri,discount_tetri,promo_code,payment_method,payment_status,notes,order_items(product_id,name_snapshot,quantity,unit_price_tetri,note),branches(name,phone)').eq('id', id).single(),
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

  if (failed) return <Screen><BackButton onPress={() => router.replace('/orders')} /><Text style={{ color: '#FFF4E0', fontFamily: fontFamily.semibold }}>{ka.order.loadFail}</Text><Button title={ka.common.retry} onPress={load} variant="ink" /></Screen>;
  if (!row) return <Screen><ActivityIndicator color={colors.yellow} /></Screen>;

  const cur = LINE_OF[row.status];
  const phase = row.status === 'delivered' ? 2 : row.status === 'out_for_delivery' ? 1 : 0;
  const bad = row.status === 'payment_failed' || row.status === 'cancelled' || row.status === 'rejected';
  const canCancel = row.status === 'pending_payment' || (row.status === 'placed' && row.payment_status !== 'paid');
  const phone = row.branches?.phone ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: '#FFF1BF' }}>
      <TrackMap phase={phase} />
      <View style={{ position: 'absolute', left: 18, top: 22 }}><BackButton onPress={() => router.replace('/orders')} /></View>
      <View style={{ flex: 1, marginTop: -28, backgroundColor: colors.white, borderTopLeftRadius: 32, borderTopRightRadius: 32, shadowColor: INK, shadowOpacity: 0.16, shadowRadius: 30, shadowOffset: { width: 0, height: -12 } }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: '#E8DDB8', alignSelf: 'center' }} />
          <View>
            <Text style={{ fontSize: 13, color: MUTED, fontFamily: fontFamily.semibold }}>შეკვეთა №{row.number}{row.branches ? ` · ${row.branches.name}` : ''}</Text>
            <Bump value={row.status}><Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 22, color: bad ? colors.red : INK }}>{STATUS_LABEL[row.status]}</Text></Bump>
          </View>

          {cur !== undefined && (
            <View>
              {LINES.map((label, i) => {
                const done = i < cur || row.status === 'delivered';
                const active = i === cur && row.status !== 'delivered';
                return (
                  <FadeIn key={label} index={i}>
                    <View style={{ flexDirection: 'row', gap: 14, minHeight: 42 }}>
                      <View style={{ alignItems: 'center', width: 26 }}>
                        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? INK : active ? colors.red : colors.white, borderWidth: done ? 0 : active ? 4 : 3, borderColor: active ? colors.yellow : '#E8DDB8' }}>
                          {done && <Text style={{ color: colors.yellow, fontSize: 13, fontFamily: fontFamily.extrabold }}>✓</Text>}
                        </View>
                        {i < LINES.length - 1 && <View style={{ flex: 1, width: 4, borderRadius: 2, marginVertical: 2, backgroundColor: done ? INK : '#E8DDB8' }} />}
                      </View>
                      <Text style={{ paddingTop: 2, fontSize: 15, fontFamily: active ? fontFamily.extrabold : done ? fontFamily.semibold : fontFamily.regular, color: active ? colors.red : done ? INK : '#8a7a70' }}>{label}</Text>
                    </View>
                  </FadeIn>
                );
              })}
            </View>
          )}

          {(row.status === 'out_for_delivery' || row.status === 'ready_for_pickup') && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF8E1', borderRadius: 20, padding: 12 }}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.white, fontFamily: fontFamily.extrabold }}>კ</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: INK }}>{ka.order.courier}</Text>
                <Text style={{ fontSize: 12, color: MUTED, fontFamily: fontFamily.regular }}>{row.status === 'out_for_delivery' ? STATUS_LABEL.out_for_delivery : STATUS_LABEL.ready_for_pickup}</Text>
              </View>
            </View>
          )}

          {phone && !finished ? <Button variant="outlineDark" title={`📞 ${ka.order.callBranch}`} onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => undefined)} /> : null}

          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: INK }}>{ka.order.items}</Text>
            {row.order_items.map((it, i) => (
              <View key={i} style={{ gap: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ flex: 1, fontFamily: fontFamily.regular, fontSize: 14, color: MUTED }}>{it.name_snapshot}</Text>
                  <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: MUTED }}>× {it.quantity}</Text>
                </View>
                {it.note ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: '#8a7a70' }}>{it.note}</Text> : null}
              </View>
            ))}
            {row.notes ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: '#8a7a70' }}>{ka.order.notePrefix}: {row.notes}</Text> : null}
            <View style={{ height: 1, backgroundColor: '#EFE3BC', marginVertical: 4 }} />
            {[[ka.cart.subtotal, formatGel(row.subtotal_tetri)], ...(row.discount_tetri > 0 ? [[`${ka.order.discount}${row.promo_code ? ` ${row.promo_code}` : ''}`, `−${formatGel(row.discount_tetri)}`]] : []), [ka.order.delivery, formatGel(row.delivery_fee_tetri)], [ka.order.method, row.payment_method === 'card' ? ka.checkout.card : ka.checkout.cash]].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: MUTED }}>{k}</Text><Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: INK }}>{v}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: MUTED }}>{ka.order.total}</Text>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: colors.red }}>{formatGel(row.total_tetri)}</Text>
            </View>
          </View>

          {row.status === 'delivered' && (
            <View style={{ gap: 10, backgroundColor: '#FFF8E1', borderRadius: 20, padding: 14 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: INK }}>{rated ? ka.order.rated : ka.order.rateTitle}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <PressScale key={n} accessibilityRole="button" accessibilityLabel={`${n}`} disabled={rated} onPress={() => setStars(n)} scaleTo={0.8}>
                    <Text style={{ fontSize: 36, color: n <= stars ? colors.yellow : '#D8CDA8' }}>★</Text>
                  </PressScale>
                ))}
              </View>
              {!rated && stars > 0 && (
                <>
                  <TextInput accessibilityLabel={ka.order.rateHint} placeholder={ka.order.rateHint} placeholderTextColor="#9b8a80" value={comment} onChangeText={setComment} maxLength={500} multiline
                    style={[{ minHeight: 60, borderRadius: 14, borderWidth: 2, borderColor: '#EFE3BC', backgroundColor: colors.white, padding: 12, fontFamily: fontFamily.regular, fontSize: 14, color: INK, textAlignVertical: 'top' }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
                  <Button title={busy ? '...' : ka.order.rateSend} onPress={sendRating} disabled={busy} variant="red" />
                </>
              )}
            </View>
          )}

          {demo && !finished && row.status !== 'pending_payment' && (
            <View style={{ gap: 10, backgroundColor: INK, borderRadius: 20, padding: 14 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.yellow }}>🧪 {ka.order.demoBanner}</Text>
              <Button variant="ink" title={busy ? '...' : ka.order.demoNext} onPress={advance} disabled={busy} />
              <Button variant="outline" title={auto ? ka.order.demoStop : ka.order.demoAuto} onPress={() => setAuto((a) => !a)} />
            </View>
          )}

          {error ? <ErrorText>{error}</ErrorText> : null}
          {canCancel && !confirmCancel ? <Button variant="outlineDark" title={ka.order.cancel} onPress={() => setConfirmCancel(true)} /> : null}
          {confirmCancel ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: INK }}>{ka.order.cancelConfirm}</Text>
              <Button title={busy ? '...' : ka.order.cancelYes} onPress={cancel} disabled={busy} />
              <Button variant="outlineDark" title={ka.order.cancelNo} onPress={() => setConfirmCancel(false)} />
            </View>
          ) : null}
          {!canCancel && !finished && row.status !== 'pending_payment' ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: MUTED }}>{ka.order.cannotCancel}</Text> : null}
          {finished ? <Button title={ka.orders.reorder} onPress={again} disabled={busy} variant="ink" /> : null}
          <Pressable accessibilityRole="button" onPress={() => router.replace('/menu')} style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.red }}>{ka.order.back}</Text>
          </Pressable>
        </ScrollView>
      </View>
      {row.status === 'delivered' && <Confetti />}
    </View>
  );
}
