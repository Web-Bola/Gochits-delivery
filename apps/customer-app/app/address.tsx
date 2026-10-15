import { useState } from 'react';
import { Text } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { ka } from '@gochits/i18n';
import { Body, Button, Field, H1, Screen } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

// MVP: the delivery point is the device location. A map pin picker comes later (needs a maps key).
export default function Address() {
  const router = useRouter();
  const { setAddress } = useCart();
  const [street, setStreet] = useState('');
  const [entrance, setEntrance] = useState('');
  const [floor, setFloor] = useState('');
  const [apartment, setApartment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // lat/lng given = fixed test point (dev only); otherwise the device location is used.
  async function save(fixed?: { lat: number; lng: number }) {
    setBusy(true); setError(null);
    try {
      let lat: number; let lng: number;
      if (fixed) {
        ({ lat, lng } = fixed);
      } else {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') { setError(ka.address.locationDenied); return; }
        const pos = await Promise.race([
          Location.getCurrentPositionAsync({}),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('location_timeout')), 10000)),
        ]);
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      }
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.replace('/login'); return; }
      const { data, error: e } = await supabase.from('addresses').insert({
        user_id: u.user.id, street, entrance: entrance || null, floor: floor || null, apartment: apartment || null,
        location: `SRID=4326;POINT(${lng} ${lat})`,
      }).select('id').single();
      if (e || !data) { console.warn('address insert failed', e); setError(__DEV__ ? `${ka.errors.generic} (${e?.message ?? ''})` : ka.errors.generic); return; }
      setAddress({ id: data.id, street, lat, lng });
      router.push('/branches');
    } catch (err) {
      console.warn('address save failed', err);
      const timeout = err instanceof Error && err.message === 'location_timeout';
      setError(timeout ? ka.address.locationTimeout : ka.errors.generic);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <H1>{ka.address.title}</H1>
      <Field label={ka.address.street} value={street} onChangeText={setStreet} autoComplete="street-address" />
      <Field label={ka.address.entrance} value={entrance} onChangeText={setEntrance} />
      <Field label={ka.address.floor} value={floor} onChangeText={setFloor} />
      <Field label={ka.address.apartment} value={apartment} onChangeText={setApartment} />
      <Body muted>{ka.branch.hint}</Body>
      {error && <Text accessibilityLiveRegion="polite" style={{ color: '#D8141C' }}>{error}</Text>}
      <Button title={busy ? ka.address.working : ka.address.save} onPress={() => save()} disabled={street.trim().length < 3 || busy} />
      {__DEV__ && <Button variant="outline" title="ტესტი: დიღმის ცენტრი" onPress={() => save({ lat: 41.755, lng: 44.765 })} disabled={street.trim().length < 3 || busy} />}
    </Screen>
  );
}
