import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../src/supabase';
import { gateFor } from '../src/gate';
import { Btn, T, c } from '../src/ui';
import { FadeIn } from '../src/fx';

export default function Pending() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [suspended, setSuspended] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => { const a = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' })); a.start(); return () => a.stop(); }, [spin]);

  const check = useCallback(async () => {
    const g = await gateFor();
    if (g === 'home') router.replace('/'); else if (g === 'login') router.replace('/welcome'); else if (g === 'register') router.replace('/register'); else setSuspended(g === 'suspended');
  }, [router]);
  useEffect(() => { check(); const t = setInterval(check, 8000); return () => clearInterval(t); }, [check]);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 480, paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: insets.bottom + 24, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <FadeIn style={{ alignItems: 'center', gap: 16 }}>
          <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: suspended ? c.redSoft : c.brandSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.Text style={{ fontSize: 52, transform: [{ rotate: suspended ? '0deg' : spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>{suspended ? '⛔' : '⏳'}</Animated.Text>
          </View>
          <T size={26} weight="extrabold" style={{ textAlign: 'center' }}>{suspended ? 'ანგარიში შეჩერებულია' : 'განაცხადი მიღებულია'}</T>
          <T size={16} color={c.muted} style={{ textAlign: 'center' }}>{suspended ? 'დაგვიკავშირდი დეტალებისთვის.' : 'ვამოწმებთ შენს მონაცემებს. დამტკიცებისას აპი თავისით გაიხსნება — ამ ეკრანზე დარჩენა აუცილებელი არ არის.'}</T>
        </FadeIn>
        <FadeIn delay={200} style={{ width: '100%', gap: 10, paddingTop: 16 }}>
          {!suspended ? <Btn title="სტატუსის შემოწმება" onPress={check} /> : null}
          <Btn title="გასვლა" kind="soft" onPress={() => supabase.auth.signOut({ scope: 'local' })} />
        </FadeIn>
      </View>
    </View>
  );
}
