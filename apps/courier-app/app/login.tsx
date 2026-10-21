import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily } from '@gochits/ui-tokens';
import { supabase } from '../src/supabase';
import { Btn, T, c } from '../src/ui';

const input = { height: 60, borderRadius: 16, backgroundColor: c.soft, color: c.ink, fontFamily: fontFamily.regular, fontSize: 17, paddingHorizontal: 18 } as const;

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function signIn() {
    setBusy(true); setError('');
    const { data, error: e } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (e || !data.user) { setBusy(false); setError('ელფოსტა ან პაროლი არასწორია'); return; }
    const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    if (p?.role !== 'courier' && p?.role !== 'super_admin') { await supabase.auth.signOut({ scope: 'local' }); setBusy(false); setError('ამ ანგარიშს კურიერის უფლება არ აქვს'); return; }
    setBusy(false);
    router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.sheet, alignItems: 'center' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, width: '100%', maxWidth: 480, paddingHorizontal: 20 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, gap: 8 }}>
          <Image source={require('../assets/zyro-logo-dark.png')} style={{ width: 200, height: 92 }} resizeMode="contain" />
          <T size={18} color={c.muted}>კურიერის აპი</T>
        </View>
        <View style={{ paddingBottom: insets.bottom + 28, gap: 12 }}>
          <T size={26} weight="extrabold">შესვლა</T>
          <TextInput style={input} placeholder="ელფოსტა" placeholderTextColor={c.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={input} placeholder="პაროლი" placeholderTextColor={c.muted} secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
          {error ? <T color={c.red} size={15}>{error}</T> : null}
          <Btn title="შესვლა" onPress={signIn} busy={busy} disabled={!email.trim() || !password} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
