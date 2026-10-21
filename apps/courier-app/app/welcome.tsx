import { Image, ImageBackground, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Btn, T, c } from '../src/ui';
import { FadeIn, Pulse } from '../src/fx';

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, alignItems: 'center' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 520 }}>
        <ImageBackground source={require('../assets/courier.jpg')} style={{ flex: 1, justifyContent: 'flex-end' }} resizeMode="cover">
          <LinearGradient colors={['rgba(23,26,27,0)', 'rgba(23,26,27,0.55)', 'rgba(23,26,27,0.92)']} locations={[0.25, 0.6, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
          <View style={{ position: 'absolute', top: insets.top + 16, left: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <FadeIn><Image source={require('../assets/zyro-logo-dark.png')} style={{ width: 110, height: 50 }} resizeMode="contain" /></FadeIn>
            <FadeIn delay={150}><View style={{ backgroundColor: c.brand, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 }}><T size={12} weight="extrabold" color="#fff">PARTNER</T></View></FadeIn>
          </View>
          <View style={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24, gap: 14 }}>
            <FadeIn delay={200}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Pulse color="#2FC4B6" /><T size={14} weight="semibold" color="#E8E8E2">მუშაობა როცა გინდა</T></View>
            </FadeIn>
            <FadeIn delay={300}><T size={36} weight="extrabold" color="#fff" style={{ lineHeight: 44 }}>გახდი ZYRO{'\n'}კურიერი</T></FadeIn>
            <FadeIn delay={400}><T size={16} color="#DCDFDA">იმუშავე შენი გრაფიკით, მიიღე შეკვეთები რესტორნებიდან და გამოიმუშავე ყოველი მიტანიდან.</T></FadeIn>
            <FadeIn delay={520} style={{ gap: 10, paddingTop: 6 }}>
              <Btn title="რეგისტრაცია" onPress={() => router.push('/register')} />
              <Btn title="შესვლა" kind="soft" onPress={() => router.push('/login')} />
            </FadeIn>
          </View>
        </ImageBackground>
      </View>
    </View>
  );
}
