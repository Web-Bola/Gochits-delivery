import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { errorText, ka } from '@gochits/i18n';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { formatGel } from '@gochits/shared';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Icon } from '../src/components/Icon';
import { Button, ErrorText, Field, Header, Screen } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

interface Zone { id: string; name: string; fee_tetri: number | null; center_lat: number | null; center_lng: number | null }

// The customer picks the quarter (one of the branch's delivery zones); its centre is the delivery point. "My location" can refine it.
// The street text is what the courier reads. No map provider is chosen yet.
export default function Address() {
  const router = useRouter();
  const { setAddress, branch } = useCart();
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [street, setStreet] = useState('');
  const [entrance, setEntrance] = useState('');
  const [floor, setFloor] = useState('');
  const [apartment, setApartment] = useState('');
  const [comment, setComment] = useState('');
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!branch) { setZones([]); return; }
    supabase.from('delivery_zones').select('id,name,fee_tetri,center_lat,center_lng').eq('branch_id', branch.id).eq('is_active', true).order('name')
      .then(({ data }) => setZones(((data ?? []) as Zone[]).filter((z) => z.center_lat != null && z.center_lng != null)));
  }, [branch]);

  function pickZone(z: Zone) {
    setZoneId(z.id);
    setPoint({ lat: z.center_lat as number, lng: z.center_lng as number });
    setError(null);
  }

  async function locate() {
    setLocating(true); setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setError(ka.address.locationDenied); return; }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({}),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('location_timeout')), 10000)),
      ]);
      setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setZoneId(null);
      if (!street.trim()) {
        try {
          const [g] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
          const guess = [g?.street, g?.streetNumber].filter(Boolean).join(' ');
          if (guess) setStreet(guess);
        } catch { /* geocoder unavailable: the customer types the street */ }
      }
    } catch (err) {
      console.warn('locate failed', err);
      setError(err instanceof Error && err.message === 'location_timeout' ? ka.address.locationTimeout : ka.errors.generic);
    } finally { setLocating(false); }
  }

  async function save(fixed?: { lat: number; lng: number }) {
    const p = fixed ?? point;
    if (!p) { setError(ka.address.needLocation); return; }
    setBusy(true); setError(null);
    const { data, error: e } = await supabase.rpc('add_address', {
      p_street: street.trim(), p_entrance: entrance, p_floor: floor, p_apartment: apartment, p_comment: comment, p_lat: p.lat, p_lng: p.lng,
    });
    setBusy(false);
    if (e || !data) { console.warn('add_address failed', e); setError(errorText(e?.message ?? '')); return; }
    setAddress({ id: String(data), street: street.trim(), lat: p.lat, lng: p.lng, entrance: entrance || null, floor: floor || null, apartment: apartment || null });
    router.back();
  }

  return (
    <Screen scroll>
      <Header back title={ka.address.title} subtitle={ka.address.hintLocation} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
        {zones && zones.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text }}>{ka.address.pickZone}</Text>
            <Text style={{ fontFamily: fontFamily.regular, fontSize: 12.5, color: theme.muted }}>{branch?.name}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {zones.map((z) => {
                const on = zoneId === z.id;
                return (
                  <Pressable key={z.id} accessibilityRole="radio" accessibilityState={{ selected: on }} onPress={() => pickZone(z)}
                    style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 22, backgroundColor: on ? colors.brand : theme.surface }}>
                    <Icon name="pin" size={16} color={on ? colors.onBrand : colors.brand} />
                    <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: on ? colors.onBrand : theme.text }}>{z.name}</Text>
                    {z.fee_tetri != null ? <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12, color: on ? colors.onBrand : theme.muted }}>{formatGel(z.fee_tetri)}</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
        <Button title={locating ? ka.address.working : point && !zoneId ? ka.address.located : ka.address.useLocation} onPress={locate} disabled={locating} variant={point && !zoneId ? 'outline' : zones && zones.length > 0 ? 'outline' : 'ink'} />
        <Field label={ka.address.street} value={street} onChangeText={setStreet} placeholder={ka.address.streetPh} autoComplete="street-address" maxLength={200} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={ka.address.entrance} value={entrance} onChangeText={setEntrance} maxLength={20} /></View>
          <View style={{ flex: 1 }}><Field label={ka.address.floor} value={floor} onChangeText={setFloor} maxLength={20} /></View>
          <View style={{ flex: 1 }}><Field label={ka.address.apartment} value={apartment} onChangeText={setApartment} maxLength={20} /></View>
        </View>
        <Field label={ka.address.comment} value={comment} onChangeText={setComment} maxLength={300} multiline />
        {error && <ErrorText>{error}</ErrorText>}
        <Button title={busy ? ka.address.working : ka.address.save} onPress={() => save()} disabled={street.trim().length < 3 || !point || busy} />
      </ScrollView>
    </Screen>
  );
}
