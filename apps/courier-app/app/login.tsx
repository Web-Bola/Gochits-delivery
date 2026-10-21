import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily } from '@gochits/ui-tokens';
import { supabase } from '../src/supabase';
import { gateFor, PATH } from '../src/gate';
import { Badge, Bg, Btn, T, c } from '../src/ui';
import { FadeIn } from '../src/fx';

export const input = { height: 54, borderRadius: 18, backgroundColor: c.sheet, borderWidth: 1, borderColor: c.line, color: c.ink, fontFamily: fontFamily.semibold, fontSize: 15, paddingHorizontal: 16 } as const;
const focusInput = { height: 58, borderRadius: 29, backgroundColor: c.sheet, borderWidth: 1.5, borderColor: c.brand, color: c.ink, fontFamily: fontFamily.semibold, fontSize: 17, paddingHorizontal: 22, shadowColor: c.brand, shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } } as const;

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    setBusy(true); setError('');
    const { error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (e) { setBusy(false); setError('ელფოსტა ან პაროლი არასწორია'); return; }
    const g = await gateFor();
    setBusy(false);
    router.replace(PATH[g]);
  }

  return (
    <Bg>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 18, gap: 14 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))} style={{ width: 40, height: 40, justifyContent: 'center' }}><T size={30} color={c.ink}>‹</T></Pressable>
            <Badge>PARTNER</Badge><View style={{ width: 40 }} />
          </View>
          <FadeIn style={{ alignItems: 'center', gap: 10, marginTop: 6 }}>
            <Image source={require('../assets/zyro-logo.png')} style={{ width: 210, height: 96 }} resizeMode="contain" />
            <T size={26} weight="extrabold" style={{ textAlign: 'center', lineHeight: 33 }}>კეთილი იყოს{'\n'}შენი დაბრუნება</T>
            <T size={14} color={c.muted} style={{ textAlign: 'center' }}>შედი შენი კურიერის ანგარიშით</T>
          </FadeIn>
          <FadeIn delay={150} style={{ gap: 12, marginTop: 6 }}>
            <TextInput style={focusInput} placeholder="ელფოსტა" placeholderTextColor={c.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={{ ...input, height: 58, borderRadius: 29, paddingHorizontal: 22, fontSize: 17 }} placeholder="პაროლი" placeholderTextColor={c.muted} secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
            {error ? <T color={c.red} size={15}>{error}</T> : null}
            <Btn title="გაგრძელება" arrow onPress={signIn} busy={busy} disabled={!email.trim() || !password} />
          </FadeIn>
          <FadeIn delay={250} style={{ alignItems: 'center' }}>
            <Pressable onPress={() => router.replace('/register')} style={{ minHeight: 40, justifyContent: 'center' }}><T size={13} color={c.muted}>ახალი ხარ? <T size={13} weight="extrabold" color={c.brand}>გახდი კურიერი</T></T></Pressable>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </Bg>
  );
}
