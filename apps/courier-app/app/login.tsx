import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily } from '@gochits/ui-tokens';
import { supabase } from '../src/supabase';
import { gateFor, PATH } from '../src/gate';
import { Btn, T, c } from '../src/ui';
import { FadeIn } from '../src/fx';

export const input = { height: 58, borderRadius: 16, backgroundColor: c.sheet, borderWidth: 1.5, borderColor: c.line, color: c.ink, fontFamily: fontFamily.regular, fontSize: 17, paddingHorizontal: 18 } as const;

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
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, width: '100%', maxWidth: 480 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 22, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/welcome')} style={{ minHeight: 44, justifyContent: 'center' }}><T size={16} weight="semibold" color={c.muted}>← უკან</T></Pressable>
          <FadeIn style={{ alignItems: 'center', paddingVertical: 28, gap: 6 }}>
            <Image source={require('../assets/zyro-logo.png')} style={{ width: 170, height: 78 }} resizeMode="contain" />
            <View style={{ backgroundColor: c.brand, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}><T size={12} weight="extrabold" color="#fff">PARTNER</T></View>
          </FadeIn>
          <FadeIn delay={120} style={{ gap: 12 }}>
            <T size={28} weight="extrabold">კეთილი იყოს შენი დაბრუნება</T>
            <T size={15} color={c.muted}>შედი შენი კურიერის ანგარიშით</T>
            <TextInput style={input} placeholder="ელფოსტა" placeholderTextColor={c.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <TextInput style={input} placeholder="პაროლი" placeholderTextColor={c.muted} secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
            {error ? <T color={c.red} size={15}>{error}</T> : null}
            <Btn title="შესვლა" onPress={signIn} busy={busy} disabled={!email.trim() || !password} />
          </FadeIn>
          <FadeIn delay={240} style={{ alignItems: 'center', paddingTop: 22 }}>
            <Pressable onPress={() => router.replace('/register')} style={{ minHeight: 44, justifyContent: 'center' }}><T size={15} color={c.muted}>ანგარიში არ გაქვს? <T size={15} weight="extrabold" color={c.brandDark}>დარეგისტრირდი</T></T></Pressable>
          </FadeIn>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
