import { Image, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Btn, T, c } from '../src/ui';
import { FadeIn, Pulse, SlideUp } from '../src/fx';

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const photoH = Math.round(height * 0.6);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 520, overflow: 'hidden', backgroundColor: c.sheet }}>
        <Image source={require('../assets/courier.jpg')} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: photoH + 40, width: '100%' }} resizeMode="cover" />
        <FadeIn style={{ position: 'absolute', top: insets.top + 16, left: 18 }}>
          <View style={{ backgroundColor: c.brand, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}><T size={13} weight="extrabold" color="#fff">ZYRO PARTNER</T></View>
        </FadeIn>
        <SlideUp k="w" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.sheet, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 22, paddingTop: 24, paddingBottom: insets.bottom + 22, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Pulse color={c.brand} size={12} /><T size={14} weight="semibold" color={c.brandDark}>მუშაობა როცა გინდა</T></View>
          <T size={32} weight="extrabold" style={{ lineHeight: 40 }}>გახდი ZYRO კურიერი</T>
          <T size={15} color={c.muted}>იმუშავე შენი გრაფიკით, მიიღე შეკვეთები რესტორნებიდან და გამოიმუშავე ყოველი მიტანიდან.</T>
          <View style={{ gap: 10, paddingTop: 8 }}>
            <Btn title="რეგისტრაცია" onPress={() => router.push('/register')} />
            <Btn title="შესვლა" kind="soft" onPress={() => router.push('/login')} />
          </View>
        </SlideUp>
      </View>
    </View>
  );
}
