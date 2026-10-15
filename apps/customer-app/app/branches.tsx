import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { nearestOrderable, formatGel, PRICE_PLACEHOLDER, sortBranchOptions, type BranchOption } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, FadeIn, Header, Screen } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

export default function Branches() {
  const router = useRouter();
  const { address, setBranch } = useCart();
  const [options, setOptions] = useState<BranchOption[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!address) { router.replace('/address'); return; }
    supabase.rpc('resolve_branches', { p_lat: address.lat, p_lng: address.lng }).then(({ data, error: e }) => {
      if (e) { console.warn('resolve_branches failed', e); setError(true); setOptions([]); return; }
      const list = sortBranchOptions((data ?? []) as BranchOption[]);
      setOptions(list);
      // D-OVERLAP is undecided: we preselect the nearest orderable branch but always let the customer choose.
      setSelected(nearestOrderable(list)?.branch_id ?? null);
    });
  }, [address, router]);

  if (!options) return <Screen><ActivityIndicator color={colors.yellow} /></Screen>;
  const nearestId = nearestOrderable(options)?.branch_id;

  return (
    <Screen scroll>
      <Header back title={ka.branch.title} subtitle={ka.branch.hint} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        {options.length === 0 && <Body>{error ? ka.errors.generic : ka.address.outside}</Body>}
        {options.map((o, i) => {
          const on = selected === o.branch_id;
          return (
            <FadeIn key={o.branch_id} index={i}>
              <Pressable accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !o.can_order }} disabled={!o.can_order} onPress={() => setSelected(o.branch_id)}>
                <Card selected={on} style={{ opacity: o.can_order ? 1 : 0.5 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text, flex: 1 }}>{o.branch_name}</Text>
                    {o.branch_id === nearestId && <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.white, backgroundColor: colors.red, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' }}>{ka.branch.nearest}</Text>}
                  </View>
                  {!o.can_order && <Body muted>{ka.branch.closed}</Body>}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                    <Body muted>{ka.branch.fee} <Text style={{ fontFamily: fontFamily.extrabold, color: theme.text }}>{o.fee_tetri === null ? PRICE_PLACEHOLDER : formatGel(o.fee_tetri)}</Text></Body>
                    <Body muted>{ka.branch.time} <Text style={{ fontFamily: fontFamily.extrabold, color: theme.text }}>+{o.extra_minutes}</Text></Body>
                    <Body muted>{ka.branch.min} <Text style={{ fontFamily: fontFamily.extrabold, color: theme.text }}>{formatGel(o.min_order_tetri)}</Text></Body>
                  </View>
                </Card>
              </Pressable>
            </FadeIn>
          );
        })}
        <Button title={ka.branch.see} disabled={!selected} onPress={() => { setBranch(options.find((o) => o.branch_id === selected) ?? null); router.push('/menu'); }} />
      </ScrollView>
    </Screen>
  );
}
