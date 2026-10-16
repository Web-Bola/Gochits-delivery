import { useState } from 'react';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { errorText, ka } from '@gochits/i18n';
import { ScrollView, View } from 'react-native';
import { Button, ErrorText, Field, Header, Screen } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

// The delivery point comes from the device location (no map provider is chosen yet). The street text is what the courier reads.
export default function Address() {
  const router = useRouter();
  const { setAddress } = useCart();
  const [street, setStreet] = useState('');
  const [entrance, setEntrance] = useState('');
  const [floor, setFloor] = useState('');
  const [apartment, setApartment] = useState('');
  const [comment, setComment] = useState('');
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <Button title={locating ? ka.address.working : point ? ka.address.located : ka.address.useLocation} onPress={locate} disabled={locating} variant={point ? 'outline' : 'ink'} />
        <Field label={ka.address.street} value={street} onChangeText={setStreet} placeholder={ka.address.streetPh} autoComplete="street-address" maxLength={200} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><Field label={ka.address.entrance} value={entrance} onChangeText={setEntrance} maxLength={20} /></View>
          <View style={{ flex: 1 }}><Field label={ka.address.floor} value={floor} onChangeText={setFloor} maxLength={20} /></View>
          <View style={{ flex: 1 }}><Field label={ka.address.apartment} value={apartment} onChangeText={setApartment} maxLength={20} /></View>
        </View>
        <Field label={ka.address.comment} value={comment} onChangeText={setComment} maxLength={300} multiline />
        {error && <ErrorText>{error}</ErrorText>}
        <Button title={busy ? ka.address.working : ka.address.save} onPress={() => save()} disabled={street.trim().length < 3 || busy} />
        {__DEV__ && <Button variant="outline" title="ტესტი: დიღმის ცენტრი" onPress={() => save({ lat: 41.755, lng: 44.765 })} disabled={street.trim().length < 3 || busy} />}
      </ScrollView>
    </Screen>
  );
}
