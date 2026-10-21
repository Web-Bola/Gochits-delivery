import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Icon } from '../src/components/Icon';
import { TabBar } from '../src/components/TabBar';
import { Bump, Shimmer, SlideUp } from '../src/components/fx';
import { FadeIn, StateView } from '../src/components/ui';
import { MerchantLogo } from '../src/components/MerchantLogo';
import { KIND_ICON, KIND_LABEL, KIND_ONE, hasBundledArt, initial, loadMerchants, type Merchant } from '../src/lib/merchants';
import { useCart } from '../src/state/cart';

const TINTS = ['#1E3A5F', '#2B3F6B', '#1F4B57', '#33406B', '#2A4A6A'];
const tintOf = (name: string) => TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length]!;

function Cover({ m, height }: { m: Merchant; height: number }) {
  if (hasBundledArt(m)) return <Image source={require('../assets/cover.jpg')} style={{ width: '100%', height }} resizeMode="cover" />;
  return (
    <View style={{ width: '100%', height, backgroundColor: tintOf(m.name), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: height * 0.55, color: 'rgba(255,255,255,0.14)' }}>{initial(m.name)}</Text>
    </View>
  );
}

export default function Home() {
  const router = useRouter();
  const { count, subtotal, branch } = useCart();
  const [list, setList] = useState<Merchant[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<string>('all');

  const load = useCallback(async () => {
    setFailed(false);
    try { setList(await loadMerchants()); } catch (e) { console.warn('merchants load failed', e); setFailed(true); setList([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { loadMerchants().then(setList).catch(() => undefined); }, []));

  const kinds = useMemo(() => [...new Set((list ?? []).map((m) => m.kind))], [list]);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => (list ?? []).filter((m) => (kind === 'all' || m.kind === kind) && (!needle || m.name.toLowerCase().includes(needle) || (m.description ?? '').toLowerCase().includes(needle))), [list, kind, needle]);
  const live = shown.filter((m) => m.any_open && m.any_accepting);
  const later = shown.filter((m) => !(m.any_open && m.any_accepting));

  const openMerchant = (m: Merchant) => router.push({ pathname: '/branches', params: { merchant: m.id, auto: '1' } });

  const tile = (id: string, label: string, icon: string) => {
    const on = kind === id;
    return (
      <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setKind(id)}
        style={{ width: 88, alignItems: 'center', gap: 8 }}>
        <View style={{ width: 72, height: 72, borderRadius: 22, backgroundColor: on ? colors.brand : theme.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: on ? colors.brand : theme.border }}>
          <Icon name={icon} size={30} color={on ? colors.onBrand : theme.text} />
        </View>
        <Text numberOfLines={1} style={{ fontFamily: on ? fontFamily.extrabold : fontFamily.semibold, fontSize: 12.5, color: on ? theme.text : theme.muted }}>{label}</Text>
      </Pressable>
    );
  };

  const card = (m: Merchant, i: number, dim: boolean) => (
    <FadeIn key={m.id} index={i}>
      <Pressable accessibilityRole="button" accessibilityLabel={m.name} onPress={() => openMerchant(m)} style={{ opacity: dim ? 0.62 : 1 }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: theme.border }}>
          <View>
            <Cover m={m} height={138} />
            <View style={{ position: 'absolute', left: 12, top: 12, flexDirection: 'row', gap: 6 }}>
              <View style={{ backgroundColor: dim ? 'rgba(11,20,36,0.85)' : colors.brand, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 11.5, color: colors.onBrand }}>{dim ? 'ახლა დაკეტილია' : 'ღიაა'}</Text>
              </View>
              {m.pickup_available ? (
                <View style={{ backgroundColor: 'rgba(11,20,36,0.85)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Icon name="bag" size={12} color={colors.onBrand} /><Text style={{ fontFamily: fontFamily.semibold, fontSize: 11.5, color: colors.onBrand }}>თვითონ წამოღება</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={{ padding: 14, paddingTop: 12, gap: 3 }}>
            <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: theme.text }}>{m.name}</Text>
            <Text numberOfLines={1} style={{ fontFamily: fontFamily.regular, fontSize: 13, color: theme.muted }}>{[KIND_ONE[m.kind], m.description].filter(Boolean).join(' · ')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Icon name="pin" size={14} color={theme.muted} />
              <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12.5, color: theme.muted }}>{m.branch_count} ფილიალი</Text>
            </View>
          </View>
        </View>
      </Pressable>
    </FadeIn>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 200 }}>
        <View style={{ paddingHorizontal: 20, paddingTop: 24, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.surface, borderRadius: 22, paddingHorizontal: 14, minHeight: 44, borderWidth: 1, borderColor: theme.border }}>
              <Icon name="pin" size={18} color={colors.brand} />
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>თბილისი</Text>
            </View>
            {branch ? (
              <Pressable accessibilityRole="button" onPress={() => router.push('/menu')} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text numberOfLines={1} style={{ fontFamily: fontFamily.semibold, fontSize: 12.5, color: colors.brand, maxWidth: 170 }}>{branch.merchantName ?? branch.name} ›</Text>
              </Pressable>
            ) : null}
          </View>
          <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 28, lineHeight: 35, color: theme.text }}>რას შეუკვეთავ დღეს?</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderRadius: 16, paddingHorizontal: 14, minHeight: 50, borderWidth: 1, borderColor: theme.border }}>
            <Icon name="search" size={20} color={theme.muted} />
            <TextInput accessibilityLabel="ძებნა" placeholder="მოძებნე რესტორანი ან მაღაზია" placeholderTextColor={theme.muted} value={q} onChangeText={setQ}
              style={[{ flex: 1, fontFamily: fontFamily.regular, fontSize: 15, color: theme.text, minWidth: 0 }, Platform.OS === 'web' && ({ outlineStyle: 'none' } as object)]} />
            {q ? <Pressable accessibilityRole="button" accessibilityLabel={ka.common.close} onPress={() => setQ('')}><Icon name="x" size={18} color={theme.muted} /></Pressable> : null}
          </View>
        </View>

        {kinds.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 20 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {tile('all', 'ყველა', 'home')}
            {kinds.map((k) => tile(k, KIND_LABEL[k] ?? k, KIND_ICON[k] ?? 'store'))}
          </ScrollView>
        ) : null}

        <View style={{ paddingHorizontal: 20, paddingTop: 22, gap: 14 }}>
          {!list ? [0, 1].map((i) => <Shimmer key={i} style={{ height: 230, borderRadius: 22, backgroundColor: theme.surface }} />) : null}
          {list && failed ? <StateView tone="error" icon="clock" title="ბიზნესები ვერ ჩაიტვირთა" hint={ka.errors.network} actionTitle={ka.common.retry} onAction={load} /> : null}
          {list && !failed && shown.length === 0 ? <StateView icon="search" title="ვერაფერი მოიძებნა" hint="სცადე სხვა სიტყვა ან კატეგორია" /> : null}
          {live.length > 0 ? <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text }}>ახლა მუშაობს</Text> : null}
          {live.map((m, i) => card(m, i, false))}
          {later.length > 0 ? <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 20, color: theme.text, marginTop: 6 }}>ამჟამად დაკეტილია</Text> : null}
          {later.map((m, i) => card(m, i + live.length, true))}
        </View>
      </ScrollView>

      {count > 0 && (
        <SlideUp style={{ position: 'absolute', left: 16, right: 16, bottom: 70 }}>
          <Bump value={count}>
            <Pressable accessibilityRole="button" onPress={() => router.push('/cart')}
              style={{ minHeight: 54, borderRadius: 27, backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 }}>
              <View style={{ minWidth: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.onBrand }}>{count}</Text></View>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.onBrand }}>{ka.menu.viewCart}</Text>
              <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.onBrand }}>{formatGel(subtotal)}</Text>
            </Pressable>
          </Bump>
        </SlideUp>
      )}
      <TabBar />
    </View>
  );
}
