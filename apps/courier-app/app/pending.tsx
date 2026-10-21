import { useCallback, useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/supabase';
import { gateFor } from '../src/gate';
import { Badge, Bg, Btn, Icon, T, c, card } from '../src/ui';
import { FadeIn, Glow, Pulse } from '../src/fx';

export default function Pending() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [suspended, setSuspended] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const check = useCallback(async (manual = false) => {
    setBusy(manual);
    const g = await gateFor();
    setBusy(false);
    if (g === 'home') router.replace('/'); else if (g === 'login') router.replace('/welcome'); else if (g === 'register') router.replace('/register');
    else { setSuspended(g === 'suspended'); if (manual) setNote(g === 'suspended' ? 'ანგარიში შეჩერებულია' : 'განაცხადი ჯერ განხილვაშია. დამტკიცებისას აპი გაიხსნება.'); }
  }, [router]);
  useEffect(() => { check(); const t = setInterval(() => check(), 8000); return () => clearInterval(t); }, [check]);

  const Row = ({ state, t, d }: { state: 'done' | 'now' | 'next'; t: string; d?: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: state === 'next' ? 0 : 1, borderBottomColor: c.line }}>
      {state === 'done' ? <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#1E9E6A', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={18} color="#fff" /></View>
        : state === 'now' ? <View style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}><Pulse size={14} color={c.brand} /></View>
        : <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: c.line }} />}
      <View style={{ flex: 1 }}><T size={14.5} weight={state === 'next' ? 'semibold' : 'extrabold'} color={state === 'next' ? c.muted : c.ink}>{t}</T>{d ? <T size={12} color={c.muted}>{d}</T> : null}</View>
    </View>
  );

  return (
    <Bg>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Image source={require('../assets/zyro-logo.png')} style={{ width: 100, height: 46 }} resizeMode="contain" />
          <Badge>{suspended ? 'შეჩერებულია' : 'განხილვაში'}</Badge>
        </View>
        <FadeIn style={{ alignItems: 'center', gap: 14, marginTop: 20 }}>
          <Glow size={150} color={suspended ? c.red : '#2FC4B6'}><Icon name={suspended ? 'out' : 'clock'} size={62} color={suspended ? c.red : '#2FC4B6'} /></Glow>
          <T size={29} weight="extrabold" style={{ textAlign: 'center', lineHeight: 35 }}>{suspended ? 'ანგარიში\nშეჩერებულია' : 'განაცხადი\nგანიხილება'}</T>
          <T size={14} color={c.muted} style={{ textAlign: 'center', lineHeight: 21, paddingHorizontal: 14 }}>{suspended ? 'დაგვიკავშირდი დეტალებისთვის.' : 'ჩვენი გუნდი ამოწმებს შენს მონაცემებს. დამტკიცებისას აპი თავისით გაიხსნება.'}</T>
        </FadeIn>
        {!suspended ? (
          <FadeIn delay={200} style={{ ...card, paddingHorizontal: 18, paddingVertical: 6, marginTop: 6 }}>
            <Row state="done" t="განაცხადი გაიგზავნა" />
            <Row state="now" t="მონაცემების შემოწმება" d="ჩვეულებრივ 1-2 სამუშაო დღე" />
            <Row state="next" t="აქტივაცია და პირველი შეკვეთა" />
          </FadeIn>
        ) : null}
        {note ? <T size={14} color={c.muted} style={{ textAlign: 'center' }}>{note}</T> : null}
        <View style={{ flex: 1 }} />
        {!suspended ? <Btn title="სტატუსის შემოწმება" busy={busy} onPress={() => check(true)} /> : null}
        <Btn title="გასვლა" kind="soft" onPress={() => supabase.auth.signOut({ scope: 'local' })} />
      </ScrollView>
    </Bg>
  );
}
