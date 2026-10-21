import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../src/components/Icon';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { errorText, ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Card, ErrorText, Field, Header } from '../src/components/ui';
import { TabBar } from '../src/components/TabBar';
import { Photo } from '../src/components/product';
import { loadMenu, type Product } from '../src/lib/menuData';
import { supabase } from '../src/lib/supabase';
import { useCart } from '../src/state/cart';
import { useFavorites } from '../src/state/favorites';

interface Addr { id: string; street: string; entrance: string | null; floor: string | null; apartment: string | null }
const SUPPORT_PHONE = '597 06 77 66';

export default function Profile() {
  const router = useRouter();
  const { resetAll, branch } = useCart();
  const fav = useFavorites();
  const reloadFav = fav.reload;
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [uid, setUid] = useState<string | null>(null);
  const [addrs, setAddrs] = useState<Addr[]>([]);
  const [favItems, setFavItems] = useState<Product[]>([]);
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
  useFocusEffect(useCallback(() => { load(); reloadFav(); }, [load, reloadFav]));
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 2500); return () => clearTimeout(t); }, [msg]);

  // favorites are shown with the menu of the current branch (price and availability differ per branch)
  useEffect(() => {
    if (!branch || fav.ids.size === 0) { setFavItems([]); return; }
    loadMenu(branch.id).then((m) => setFavItems(m.products.filter((p) => fav.ids.has(p.id)))).catch(() => undefined);
  }, [branch, fav.ids]);

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
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 24, color: colors.onBrand }}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{name.trim() || ka.profile.namePh}</Text>
            <Body muted>{phone ? `+${phone.replace(/^\+/, '')}` : ' '}</Body>
          </View>
        </Card>
        <Field label={ka.profile.name} value={name} onChangeText={setName} placeholder={ka.profile.namePh} maxLength={60} />
        <Button title={msg ?? ka.profile.save} onPress={save} variant="ink" disabled={!uid} />
        {error && <ErrorText>{error}</ErrorText>}

        <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: theme.text, marginTop: 8 }}>{ka.profile.favorites}</Text>
        {favItems.length === 0 ? <Body muted>{ka.profile.noFavorites}</Body> : favItems.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.id } })}>
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 }}>
              <Photo path={p.image_path} style={{ width: 56, height: 56 }} rounded={14} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>{p.name}</Text>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 13, color: colors.brand }}>{formatGel(p.price_tetri)}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={ka.menu.favRemove} onPress={() => fav.toggle(p.id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="heart" size={22} color={colors.red} fill={colors.red} />
              </Pressable>
            </Card>
          </Pressable>
        ))}

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

        <Pressable accessibilityRole="button" onPress={() => Linking.openURL(`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`).catch(() => undefined)}>
          <Card>
            <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.profile.support}</Text>
            <Body muted>{ka.profile.supportTxt}: <Text style={{ color: colors.brand, fontFamily: fontFamily.extrabold }}>{SUPPORT_PHONE}</Text></Body>
          </Card>
        </Pressable>
        <Card>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.profile.legalTerms} ›</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{ka.profile.legalPrivacy} ›</Text></Pressable>
        </Card>

        <Button variant="outline" title={ka.profile.logout} onPress={logout} />
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
