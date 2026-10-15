import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, ErrorText, Field, Header } from '../src/components/ui';
import { TabBar } from '../src/components/TabBar';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';

interface Addr { id: string; street: string }

export default function Profile() {
  const router = useRouter();
  const { clear, setAddress, setBranch } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [uid, setUid] = useState<string | null>(null);
  const [addrs, setAddrs] = useState<Addr[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { router.replace('/login'); return; }
    setUid(u.user.id); setPhone(u.user.phone ?? '');
    const [p, a] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', u.user.id).maybeSingle(),
      supabase.from('addresses').select('id,street').order('created_at', { ascending: false }),
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
    await supabase.auth.signOut();
    clear(); setAddress(null); setBranch(null);
    router.replace('/login');
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title={ka.profile.title} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 110 }}>
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 24, color: colors.ink }}>{(name.trim()[0] ?? '👤').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{name.trim() || ka.profile.namePh}</Text>
            <Body muted>{phone ? `+${phone.replace(/^\+/, '')}` : ' '}</Body>
          </View>
        </Card>
        <Field label={ka.profile.name} value={name} onChangeText={setName} placeholder={ka.profile.namePh} />
        <Button title={msg ?? ka.profile.save} onPress={save} variant="ink" disabled={!uid} />
        {error && <ErrorText>{error}</ErrorText>}

        <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: theme.text, marginTop: 8 }}>{ka.profile.addresses}</Text>
        {addrs.length === 0 && <Body muted>{ka.profile.noAddresses}</Body>}
        {addrs.map((a) => (
          <Card key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>📍</Text>
            <Text numberOfLines={2} style={{ flex: 1, fontFamily: fontFamily.semibold, fontSize: 14, color: theme.text }}>{a.street}</Text>
            <Text accessibilityRole="button" onPress={() => removeAddr(a.id)} style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: '#FF6B6B', padding: 8 }}>{ka.profile.delete}</Text>
          </Card>
        ))}
        <Button variant="outline" title={`+ ${ka.profile.addNew}`} onPress={() => router.push('/address')} />

        <Card>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.profile.support}</Text>
          <Body muted>{ka.profile.supportTxt}: 597 06 77 66</Body>
        </Card>
        <Card>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.profile.terms}</Text>
          <Body muted>{ka.profile.termsTxt}</Body>
        </Card>
        <Card>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.profile.deleteAccount}</Text>
          <Body muted>{ka.profile.deleteTxt}</Body>
        </Card>
        <Button variant="outline" title={ka.profile.logout} onPress={logout} />
        <Text style={{ fontFamily: fontFamily.regular, fontSize: 11, color: theme.muted, textAlign: 'center' }}>{ka.profile.version}</Text>
      </ScrollView>
      <TabBar />
    </View>
  );
}
