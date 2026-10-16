import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { supabase } from '../src/supabase';
import { Btn, T } from '../src/ui';

const input = { height: 54, borderRadius: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, color: theme.text, fontFamily: fontFamily.regular, fontSize: 16, paddingHorizontal: 16 } as const;

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ backgroundColor: colors.yellow, paddingTop: insets.top + 36, paddingBottom: 36, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
        <Image source={require('../assets/logo.png')} style={{ width: 180, height: 96 }} resizeMode="contain" />
        <T size={15} weight="extrabold" color={colors.ink} style={{ marginTop: 8 }}>კურიერი</T>
      </View>
      <View style={{ padding: 24, gap: 14 }}>
        <TextInput style={input} placeholder="ელფოსტა" placeholderTextColor={theme.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={input} placeholder="პაროლი" placeholderTextColor={theme.muted} secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={signIn} />
        {error ? <T color="#ff8a80" size={14}>{error}</T> : null}
        <Btn title="შესვლა" onPress={signIn} busy={busy} disabled={!email.trim() || !password} />
      </View>
    </KeyboardAvoidingView>
  );
}
