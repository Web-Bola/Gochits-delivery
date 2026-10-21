import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { ErrorText } from '../src/components/ui';
import { AuthShell } from '../src/components/AuthShell';
import { Keypad } from '../src/components/Keypad';
import { supabase } from '../src/lib/supabase';

export default function Otp() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sent = useRef('');

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  // the code is checked as soon as the sixth digit is in
  useEffect(() => {
    if (code.length !== 6 || sent.current === code) return;
    sent.current = code;
    (async () => {
      setBusy(true); setError(null);
      const { error: e } = await supabase.auth.verifyOtp({ phone: `+995${phone}`, token: code, type: 'sms' });
      setBusy(false);
      if (e) { console.warn('verifyOtp failed', e); setError(__DEV__ ? `${ka.otp.wrong} (${e.message})` : ka.otp.wrong); setCode(''); sent.current = ''; return; }
      router.replace('/home');
    })();
  }, [code, phone, router]);

  async function resend() {
    setLeft(30); setError(null);
    await supabase.auth.signInWithOtp({ phone: `+995${phone}` });
  }
  const mmss = `00:${String(left).padStart(2, '0')}`;

  return (
    <AuthShell back photo="otp" title="შეიყვანე SMS კოდი" subtitle={<>გამოგიგზავნეთ 6-ნიშნა კოდი ნომერზე <Text style={{ color: theme.text, fontFamily: fontFamily.extrabold }}>+995 {phone ?? ''}</Text></>}
      bottom={<Keypad letters="en" onDigit={(d) => !busy && setCode((v) => (v.length < 6 ? v + d : v))} onBack={() => setCode((v) => v.slice(0, -1))} confirm={{ enabled: code.length === 6 && !busy, onPress: () => setCode((v) => v) }} />}>
      <View accessibilityLabel={ka.otp.title} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const on = i === code.length;
          return (
            <View key={i} style={{ flex: 1, height: 60, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.85)', borderWidth: 1.5, borderColor: on ? colors.brand : theme.border, alignItems: 'center', justifyContent: 'center' }}>
              {code[i] ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 24, color: theme.text }}>{code[i]}</Text> : <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: on ? colors.brand : theme.border }} />}
            </View>
          );
        })}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      {left > 0 ? (
        <Text style={{ fontFamily: fontFamily.regular, fontSize: 13, color: theme.muted, textAlign: 'center' }}>{ka.otp.resend} <Text style={{ color: colors.brand, fontFamily: fontFamily.extrabold }}>{mmss}</Text></Text>
      ) : (
        <Pressable accessibilityRole="button" onPress={resend} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.brand }}>{ka.otp.resend}</Text>
        </Pressable>
      )}
    </AuthShell>
  );
}
