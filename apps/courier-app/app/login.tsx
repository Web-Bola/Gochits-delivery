import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily } from '@gochits/ui-tokens';
import { supabase } from '../src/supabase';
import { Btn, T, c } from '../src/ui';

const input = { height: 56, borderRadius: 28, backgroundColor: c.soft, color: c.ink, fontFamily: fontFamily.regular, fontSize: 16, paddingHorizontal: 22 } as const;

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
    <View style={{ flex: 1, backgroundColor: colors.yellow, alignItems: 'center' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, width: '100%', maxWidth: 520 }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top }}>
          <Image source={require('../assets/logo.png')} style={{ width: 230, height: 122 }} resizeMode="contain" />
          <T size={16} weight="extrabold" color={colors.ink} style={{ marginTop: 6, letterSpacing: 1 }}>კურიერი</T>
        </View>
        <View style={{ backgroundColor: c.sheet, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: insets.bottom + 24, gap: 12 }}>
          <T size={22} weight="extrabold">შესვლა</T>
          <TextInput style={input} placeholder="ელფოსტა" placeholderTextColor={c.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextInput style={input} placeholder="პაროლი" placeholderTextColor={c.muted} secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
          {error ? <T color={c.red} size={14}>{error}</T> : null}
          <Btn title="შესვლა" onPress={signIn} busy={busy} disabled={!email.trim() || !password} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
