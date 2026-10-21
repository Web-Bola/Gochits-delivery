import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../src/components/Icon';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { errorText, ka } from '@gochits/i18n';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, ErrorText, Field, Header } from '../src/components/ui';
import { TabBar } from '../src/components/TabBar';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

interface Addr { id: string; street: string; entrance: string | null; floor: string | null; apartment: string | null }
const SUPPORT_PHONE = '597 06 77 66';

export default function Profile() {
  const router = useRouter();
  const { resetAll } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [uid, setUid] = useState<string | null>(null);
  const [addrs, setAddrs] = useState<Addr[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { router.replace('/login'); return; }
    setUid(u.user.id); setPhone(u.user.phone ?? '');
    const [p, a] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', u.user.id).maybeSingle(),
      supabase.rpc('my_addresses'),
    ]);
    setName((p.data as { full_name: string | null } | null)?.full_name ?? '');
    setAddrs((a.data ?? []) as Addr[]);
  }, [router]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2500); return () => clearTimeout(t); }, [msg]);

  async function save() {
    if (!uid) return;
    setError(null);
    const { error: e } = await supabase.from('profiles').update({ full_name: name.trim() || null }).eq('id', uid);
    if (e) { setError(ka.errors.generic); return; }
    setMsg(ka.profile.saved);
  }
  async function removeAddr(id: string) {
    const { error: e } = await supabase.from('addresses').delete().eq('id', id);
    if (e) { setError(ka.errors.generic); return; }
    setAddrs((l) => l.filter((x) => x.id !== id));
  }
  async function logout() {
    await supabase.auth.signOut({ scope: 'local' });
    resetAll();
    router.replace('/login');
  }
  async function deleteAccount() {
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc('delete_my_account');
    if (e) { setBusy(false); setConfirmDelete(false); setError(e.message === 'active_order' ? ka.profile.deleteBlocked : errorText(e.message)); return; }
    await supabase.auth.signOut().catch(() => undefined);
    resetAll();
    router.replace('/login');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={ka.profile.title} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <LinearGradient colors={['#7DF2D6', '#2CC9A2']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 24, color: colors.onBrand }}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
          </LinearGradient>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{name.trim() || ka.profile.namePh}</Text>
            <Body muted>{phone ? `+${phone.replace(/^\+/, '')}` : ' '}</Body>
          </View>
        </Card>
        <Field label={ka.profile.name} value={name} onChangeText={setName} placeholder={ka.profile.namePh} maxLength={60} />
        <Button title={msg ?? ka.profile.save} onPress={save} variant="ink" disabled={!uid} />
        {error && <ErrorText>{error}</ErrorText>}

        <Card style={{ paddingVertical: 2, paddingHorizontal: 14 }}>
          {[['receipt', ka.tabs.orders, () => router.push('/orders')], ['heart', 'ფავორიტები', () => router.push('/favorites')], ['phone', ka.profile.support, () => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`).catch(() => undefined)]].map(([ic, label, go], i, all) => (
            <Pressable key={String(label)} accessibilityRole="button" onPress={go as () => void} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: i < all.length - 1 ? 1 : 0, borderBottomColor: theme.border }}>
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(56,217,176,0.12)', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic as string} size={20} color={colors.brand} /></View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fontFamily.semibold, fontSize: 15, color: theme.text }}>{label as string}</Text>
                {ic === 'phone' ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{SUPPORT_PHONE}</Text> : null}
              </View>
              <Text style={{ color: theme.muted, fontSize: 22 }}>›</Text>
            </Pressable>
          ))}
        </Card>

        <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: theme.text, marginTop: 8 }}>{ka.profile.addresses}</Text>
        {addrs.length === 0 && <Body muted>{ka.profile.noAddresses}</Body>}
        {addrs.map((a) => (
          <Card key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="pin" size={20} color={colors.brand} />
            <Text numberOfLines={2} style={{ flex: 1, fontFamily: fontFamily.semibold, fontSize: 14, color: theme.text }}>{a.street}</Text>
            <Text accessibilityRole="button" onPress={() => removeAddr(a.id)} style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: '#D63A2F', padding: 8 }}>{ka.profile.delete}</Text>
          </Card>
        ))}
        <Button variant="outline" title={`+ ${ka.profile.addNew}`} onPress={() => router.push('/address')} />

        <Card>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.profile.legalTerms} ›</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.profile.legalPrivacy} ›</Text></Pressable>
        </Card>

        <Pressable accessibilityRole="button" onPress={logout} style={{ minHeight: 50, borderWidth: 1, borderColor: 'rgba(255,113,133,0.5)', borderRadius: 25, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.red }}>{ka.profile.logout}</Text>
        </Pressable>
        {!confirmDelete ? (
          <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: 13, color: '#D63A2F' }}>{ka.profile.deleteAccount}</Text>
          </Pressable>
        ) : (
          <Card style={{ borderColor: colors.red, gap: 10 }}>
            <Text style={{ fontFamily: fontFamily.semibold, fontSize: 14, color: theme.text }}>{ka.profile.deleteConfirm}</Text>
            <Button title={busy ? '...' : ka.profile.deleteYes} onPress={deleteAccount} disabled={busy} />
            <Button variant="outline" title={ka.profile.deleteNo} onPress={() => setConfirmDelete(false)} />
          </Card>
        )}
        <Text style={{ fontFamily: fontFamily.regular, fontSize: 11, color: theme.muted, textAlign: 'center' }}>v{Constants.expoConfig?.version ?? ''}</Text>
      </ScrollView>
      <TabBar />
    </View>
  );
}
