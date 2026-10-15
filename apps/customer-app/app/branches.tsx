import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { nearestOrderable, formatGel, PRICE_PLACEHOLDER, sortBranchOptions, type BranchOption } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, radius } from '@gochits/ui-tokens';
import { Body, Button, H1, Screen } from '../src/components/ui';
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
      if (e) { setError(true); setOptions([]); return; }
      const list = sortBranchOptions((data ?? []) as BranchOption[]);
      setOptions(list);
      // D-OVERLAP is undecided: we preselect the nearest orderable branch but always let the customer choose.
      setSelected(nearestOrderable(list)?.branch_id ?? null);
    });
  }, [address, router]);

  if (!options) return <Screen><ActivityIndicator color={colors.ink} /></Screen>;

  const nearestId = nearestOrderable(options)?.branch_id;

  return (
    <Screen>
      <H1>{ka.branch.title}</H1>
      {options.length === 0 && <Body>{error ? ka.errors.generic : ka.address.outside}</Body>}
      {options.map((o) => {
        const on = selected === o.branch_id;
        return (
          <Pressable key={o.branch_id} accessibilityRole="radio" accessibilityState={{ selected: on, disabled: !o.can_order }} disabled={!o.can_order}
            onPress={() => setSelected(o.branch_id)}
            style={{ padding: 16, borderRadius: radius.card, backgroundColor: colors.white, borderWidth: 3, borderColor: on ? colors.red : colors.sand, opacity: o.can_order ? 1 : 0.5, gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.ink }}>{o.branch_name}</Text>
              {o.branch_id === nearestId && <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.white, backgroundColor: colors.red, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' }}>{ka.branch.nearest}</Text>}
            </View>
            {!o.can_order && <Body muted>{ka.branch.closed}</Body>}
            <Body muted>{ka.branch.fee} {o.fee_tetri === null ? PRICE_PLACEHOLDER : formatGel(o.fee_tetri)} · {ka.branch.time} +{o.extra_minutes} · {ka.branch.min} {formatGel(o.min_order_tetri)}</Body>
          </Pressable>
        );
      })}
      <Button title={ka.branch.see} disabled={!selected} onPress={() => { setBranch(options.find((o) => o.branch_id === selected) ?? null); router.push('/menu'); }} />
    </Screen>
  );
}
