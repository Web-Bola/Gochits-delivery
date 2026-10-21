import { Image, ImageBackground, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge, Bg, Btn, Icon, T, c, type IconName } from '../src/ui';
import { FadeIn } from '../src/fx';

const PERKS: [IconName, string][] = [['clock', 'თავისუფალი გრაფიკი'], ['wallet', 'გამჭვირვალე შემოსავალი და გადახდები'], ['shield', 'მხარდაჭერა ყოველ ნაბიჯზე']];

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Bg>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: insets.top + 14, paddingBottom: insets.bottom + 16, gap: 18 }}>
        <FadeIn style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Image source={require('../assets/zyro-logo.png')} style={{ width: 118, height: 54 }} resizeMode="contain" />
          <Badge>PARTNER</Badge>
        </FadeIn>
        <FadeIn delay={100}>
          <ImageBackground source={require('../assets/courier.jpg')} style={{ height: 270, borderRadius: 30, overflow: 'hidden' }} imageStyle={{ borderRadius: 30 }} resizeMode="cover">
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,40,36,0.45)']} locations={[0.55, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
            <View style={{ position: 'absolute', left: 14, top: 14, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 }}><T size={12} weight="extrabold">⚡ ახლავე დაიწყე</T></View>
          </ImageBackground>
        </FadeIn>
        <FadeIn delay={200}>
          <T size={31} weight="extrabold" style={{ lineHeight: 38 }}>იმუშავე როცა გინდა.{'\n'}<T size={31} weight="extrabold" color={c.brand}>იშოვე ყოველ შეკვეთაზე.</T></T>
          <T size={14} color={c.muted} style={{ marginTop: 10, lineHeight: 21 }}>გახდი ZYRO Partner: აირჩიე შენთვის სასურველი დრო და მიიტანე შეკვეთები შენს ქალაქში.</T>
        </FadeIn>
        <View style={{ gap: 10 }}>
          {PERKS.map(([ic, t], i) => (
            <FadeIn key={t} delay={300 + i * 90} from={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(11,167,154,0.14)', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic} size={19} color={c.brand} /></View>
              <T size={14} weight="semibold">{t}</T>
            </FadeIn>
          ))}
        </View>
        <View style={{ flex: 1 }} />
        <FadeIn delay={560} style={{ gap: 10 }}>
          <Btn title="კურიერად რეგისტრაცია" arrow onPress={() => router.push('/register')} />
          <Btn title="უკვე მაქვს ანგარიში · შესვლა" kind="soft" onPress={() => router.push('/login')} />
        </FadeIn>
      </ScrollView>
    </Bg>
  );
}
