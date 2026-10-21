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
    <AuthShell back title="შეიყვანე 6-ნიშნა კოდი" subtitle={`კოდი გაიგზავნა +995 ${phone ?? ''} ნომერზე`}
      bottom={<Keypad onDigit={(d) => !busy && setCode((v) => (v.length < 6 ? v + d : v))} onBack={() => setCode((v) => v.slice(0, -1))} />}>
      <View accessibilityLabel={ka.otp.title} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const on = i === code.length;
          return (
            <View key={i} style={{ flex: 1, height: 56, borderRadius: 12, backgroundColor: theme.surface, borderWidth: 1.5, borderColor: on ? colors.brand : code[i] ? theme.border : theme.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 24, color: theme.text }}>{code[i] ?? ''}</Text>
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
