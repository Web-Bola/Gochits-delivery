import { useState } from 'react';
import { ka } from '@gochits/i18n';
import { Body, Button, ErrorText, Field, H1, Hero } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';
import { useRouter } from 'expo-router';

export default function Login() {
  const router = useRouter();
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = digits.length === 9;

  async function send() {
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.signInWithOtp({ phone: `+995${digits}` });
    setBusy(false);
    if (e) { console.warn('signInWithOtp failed', e); setError(__DEV__ ? `${ka.errors.generic} (${e.message})` : ka.errors.generic); return; }
    router.push({ pathname: '/otp', params: { phone: digits } });
  }

  return (
    <Hero>
      <H1>{ka.login.title}</H1>
      <Body muted>+995</Body>
      <Field label={ka.login.phone} keyboardType="number-pad" maxLength={9} value={digits} onChangeText={(t) => setDigits(t.replace(/\D/g, ''))} placeholder="5XX XXX XXX" autoComplete="tel" />
      {digits.length > 0 && !valid && <ErrorText>{ka.login.invalid}</ErrorText>}
      {error && <ErrorText>{error}</ErrorText>}
      <Button title={ka.login.send} onPress={send} disabled={!valid || busy} />
    </Hero>
  );
}
