import { useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Button, ErrorText } from '../src/components/ui';
import { AuthShell } from '../src/components/AuthShell';
import { Keypad } from '../src/components/Keypad';
import { supabase } from '../src/lib/supabase';

const group = (d: string) => [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(' ');

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
    <AuthShell photo="login" title="კეთილი იყოს თქვენი მობრძანება!" subtitle="შეიყვანეთ თქვენი ტელეფონის ნომერი ანგარიშზე შესასვლელად"
      bottom={<Keypad onDigit={(d) => setDigits((v) => (v.length < 9 ? v + d : v))} onBack={() => setDigits((v) => v.slice(0, -1))} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderRadius: 27, borderWidth: 1.5, borderColor: digits ? colors.brand : theme.border, backgroundColor: 'rgba(22,18,16,0.85)', paddingHorizontal: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface2, borderRadius: 12, paddingHorizontal: 10, height: 38 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}><View style={{ position: 'absolute', width: 4, height: 24, backgroundColor: '#E8112D' }} /><View style={{ position: 'absolute', width: 24, height: 4, backgroundColor: '#E8112D' }} /><View style={{ position: 'absolute', left: 5.5, top: 4, width: 1.5, height: 5, backgroundColor: '#E8112D' }} /><View style={{ position: 'absolute', left: 3.75, top: 5.75, width: 5, height: 1.5, backgroundColor: '#E8112D' }} /><View style={{ position: 'absolute', left: 16.5, top: 4, width: 1.5, height: 5, backgroundColor: '#E8112D' }} /><View style={{ position: 'absolute', left: 14.75, top: 5.75, width: 5, height: 1.5, backgroundColor: '#E8112D' }} /><View style={{ position: 'absolute', left: 5.5, top: 15, width: 1.5, height: 5, backgroundColor: '#E8112D' }} /><View style={{ position: 'absolute', left: 3.75, top: 16.75, width: 5, height: 1.5, backgroundColor: '#E8112D' }} /><View style={{ position: 'absolute', left: 16.5, top: 15, width: 1.5, height: 5, backgroundColor: '#E8112D' }} /><View style={{ position: 'absolute', left: 14.75, top: 16.75, width: 5, height: 1.5, backgroundColor: '#E8112D' }} /></View>
          <Text style={{ fontFamily: fontFamily.semibold, fontSize: 15, color: theme.text }}>+995</Text>
        </View>
        <View style={{ width: 1, height: 22, backgroundColor: theme.border }} />
        <TextInput accessibilityLabel={ka.login.phone} value={group(digits)} onChangeText={(t) => setDigits(t.replace(/\D/g, '').slice(0, 9))} placeholder="555 123 456" placeholderTextColor={theme.muted}
          keyboardType="number-pad" showSoftInputOnFocus={false} autoComplete="tel"
          style={[{ flex: 1, minWidth: 0, fontFamily: fontFamily.semibold, fontSize: 17, color: theme.text }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
      </View>
      {digits.length > 0 && !valid ? <ErrorText>{ka.login.invalid}</ErrorText> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button title={busy ? '…' : 'გაგრძელება'} onPress={send} disabled={!valid || busy} arrow />
    </AuthShell>
  );
}
