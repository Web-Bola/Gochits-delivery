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

  async function save() {
    setBusy(true); setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setError(ka.errors.generic); return; }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude: lat, longitude: lng } = pos.coords;
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { router.replace('/login'); return; }
      const { data, error: e } = await supabase.from('addresses').insert({
        user_id: u.user.id, street, entrance: entrance || null, floor: floor || null, apartment: apartment || null,
        location: `SRID=4326;POINT(${lng} ${lat})`,
      }).select('id').single();
      if (e || !data) { setError(ka.errors.generic); return; }
      setAddress({ id: data.id, street, lat, lng });
      router.push('/branches');
    } catch {
      setError(ka.errors.generic);
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
      <Button title={ka.address.save} onPress={save} disabled={street.trim().length < 3 || busy} />
    </Screen>
  );
}
