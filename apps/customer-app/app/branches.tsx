import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { nearestOrderable, sortBranchOptions, type BranchOption } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, ErrorText, FadeIn, Header, Screen } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

interface Row { id: string; name: string; address: string | null; phone: string | null; accepts_orders: boolean; is_open: boolean }

/** Branch picker. The menu and sold-out items depend on the branch. "Nearest" works through delivery zones (server side), so it needs the zones to be filled in. */
export default function Branches() {
  const router = useRouter();
  const { branch, setBranch, count, ready } = useCart();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<Row | null>(null);
  const [nearestId, setNearestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    const { data, error } = await supabase.rpc('list_branches');
    if (error) { console.warn('list_branches failed', error); setFailed(true); setRows([]); return; }
    setRows((data ?? []) as Row[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const choose = useCallback((r: Row, force = false) => {
    if (branch && branch.id !== r.id && count > 0 && !force) { setPending(r); return; }
    setBranch({ id: r.id, name: r.name });
    router.replace('/menu');
  }, [branch, count, setBranch, router]);

  async function locate() {
    setLocating(true); setNote(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setNote(ka.address.locationDenied); return; }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({}),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000)),
      ]);
      const { data, error } = await supabase.rpc('resolve_branches', { p_lat: pos.coords.latitude, p_lng: pos.coords.longitude });
      if (error) throw error;
      const best = nearestOrderable(sortBranchOptions((data ?? []) as BranchOption[]));
      if (!best) { setNote(ka.branch.locateFail); return; }
      setNearestId(best.branch_id);
      const row = rows?.find((r) => r.id === best.branch_id);
      if (row) choose(row);
    } catch (e) {
      console.warn('locate failed', e);
      setNote(e instanceof Error && e.message === 'timeout' ? ka.address.locationTimeout : ka.errors.generic);
    } finally { setLocating(false); }
  }

  if (!rows || !ready) return <Screen><ActivityIndicator color={colors.yellow} /></Screen>;
  const first = !branch;
  return (
    <Screen scroll>
      <Header back={!first} showLogo={first} title={first ? ka.branch.pickTitle : ka.branch.title} subtitle={ka.branch.pickHint} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
        <Button title={locating ? ka.branch.locating : `📍 ${ka.branch.locate}`} onPress={locate} disabled={locating} variant="ink" />
        {note ? <ErrorText>{note}</ErrorText> : null}
        {failed ? <><Body>{ka.errors.network}</Body><Button title={ka.common.retry} onPress={load} variant="outline" /></> : null}
        {pending ? (
          <Card style={{ borderColor: colors.red, gap: 10 }}>
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: theme.text }}>{ka.branch.changeWarn}</Text>
            <Button title={ka.branch.changeYes} onPress={() => choose(pending, true)} />
            <Button title={ka.branch.changeNo} variant="outline" onPress={() => setPending(null)} />
          </Card>
        ) : null}
        {rows.map((r, i) => {
          const on = branch?.id === r.id;
          const live = r.accepts_orders && r.is_open;
          return (
            <FadeIn key={r.id} index={i}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => choose(r)}>
                <Card selected={on} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: live ? '#3DDC84' : colors.red }} />
                    <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text, flex: 1 }}>{r.name}</Text>
                    {r.id === nearestId ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.white, backgroundColor: colors.red, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' }}>{ka.branch.nearest}</Text> : null}
                    {on ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.ink, backgroundColor: colors.yellow, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' }}>{ka.branch.current}</Text> : null}
                  </View>
                  {r.address ? <Body muted>{r.address}</Body> : null}
                  <Body muted>{!r.accepts_orders ? ka.branch.notAccepting : r.is_open ? ka.branch.open : ka.branch.closedNow}</Body>
                </Card>
              </Pressable>
            </FadeIn>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
