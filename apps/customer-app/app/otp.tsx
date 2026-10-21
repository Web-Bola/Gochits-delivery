import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ka } from '@gochits/i18n';
import { Body, Button, ErrorText, Field, H1, Hero } from '../src/components/ui';
import { supabase } from '../src/lib/supabase';

export default function Otp() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function confirm() {
    setBusy(true); setError(null);
    const { error: e } = await supabase.auth.verifyOtp({ phone: `+995${phone}`, token: code, type: 'sms' });
    setBusy(false);
    if (e) { console.warn('verifyOtp failed', e); setError(__DEV__ ? `${ka.otp.wrong} (${e.message})` : ka.otp.wrong); return; }
    router.replace('/home');
  }

  async function resend() {
    setLeft(30);
    await supabase.auth.signInWithOtp({ phone: `+995${phone}` });
  }

  return (
    <Hero small>
      <H1>{ka.otp.title}</H1>
      <Body muted>+995 {phone}</Body>
      <Field label={ka.otp.title} keyboardType="number-pad" maxLength={6} value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} autoComplete="sms-otp" textContentType="oneTimeCode" />
      {error && <ErrorText>{error}</ErrorText>}
      <Button title={ka.otp.confirm} onPress={confirm} disabled={code.length !== 6 || busy} />
      <Button variant="outline" title={left > 0 ? `${ka.otp.resend} (${left})` : ka.otp.resend} onPress={resend} disabled={left > 0} />
    </Hero>
  );
}
