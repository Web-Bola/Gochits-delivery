import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Button, ErrorText } from '../src/components/ui';
import { AuthShell } from '../src/components/AuthShell';
import { Keypad } from '../src/components/Keypad';
import { supabase } from '../src/lib/supabase';

const group = (d: string) => [d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');

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
    <AuthShell title="შესვლა ნომრით" subtitle="შეიყვანე ნომერი რომ გააგრძელო"
      bottom={<Keypad onDigit={(d) => setDigits((v) => (v.length < 9 ? v + d : v))} onBack={() => setDigits((v) => v.slice(0, -1))} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderRadius: 14, borderWidth: 1.5, borderColor: digits ? colors.brand : theme.border, backgroundColor: theme.surface, paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 20 }}>🇬🇪</Text>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: theme.text }}>+995</Text>
        <TextInput accessibilityLabel={ka.login.phone} value={group(digits)} onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 9))} placeholder="5XX XX XX XX" placeholderTextColor={theme.muted}
          keyboardType="number-pad" showSoftInputOnFocus={false} autoComplete="tel"
          style={[{ flex: 1, minWidth: 0, fontFamily: fontFamily.semibold, fontSize: 17, color: theme.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
      </View>
      {digits.length > 0 && !valid ? <ErrorText>{ka.login.invalid}</ErrorText> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title={busy ? '…' : 'კოდის გაგზავნა'} onPress={send} disabled={!valid || busy} variant="ink" />
    </AuthShell>
  );
}
