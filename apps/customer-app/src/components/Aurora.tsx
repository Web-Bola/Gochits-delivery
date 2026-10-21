import { Animated, Image, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@gochits/ui-tokens';
import { useLoop } from './fx';

/** Animated brand backdrop (no photo): deep navy, three soft glows drifting slowly and faint rings. */
function Glow({ size, color, top, left, dx, dy, duration, delay }: { size: number; color: string; top: number; left: number; dx: number; dy: number; duration: number; delay: number }) {
  const v = useLoop(duration, delay);
  const x = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dx, 0] });
  const y = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dy, 0] });
  const s = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] });
  // soft edge without blur: stacked circles, each one a little smaller, so the glow fades out
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top, left, width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: x }, { translateY: y }, { scale: s }] }}>
      {[1, 0.82, 0.66, 0.52, 0.4, 0.3, 0.2].map((k) => <View key={k} style={{ position: 'absolute', width: size * k, height: size * k, borderRadius: (size * k) / 2, backgroundColor: color }} />)}
    </Animated.View>
  );
}

const F = {
  hamburger: require('../../assets/art/f/hamburger_3d.png'), pizza: require('../../assets/art/f/pizza_3d.png'), sushi: require('../../assets/art/f/sushi_3d.png'),
  coffee: require('../../assets/art/f/hot_beverage_3d.png'), fries: require('../../assets/art/f/french_fries_3d.png'), bowl: require('../../assets/art/f/steaming_bowl_3d.png'),
  salad: require('../../assets/art/f/green_salad_3d.png'), taco: require('../../assets/art/f/taco_3d.png'), donut: require('../../assets/art/f/doughnut_3d.png'), meat: require('../../assets/art/f/cut_of_meat_3d.png'),
} as const;
const ORDER = ['hamburger', 'pizza', 'sushi', 'coffee', 'fries', 'bowl', 'salad', 'taco', 'donut', 'meat'] as const;
type D = { n: string; x: string; y: string; size: number; rot: number; o: number };
const DOODLES: D[] = [
  { n: 'cburger', x: '8%', y: '7%', size: 54, rot: -14, o: 0.2 }, { n: 'cfries', x: '74%', y: '5%', size: 48, rot: 12, o: 0.16 },
  { n: 'ccup', x: '40%', y: '14%', size: 40, rot: -8, o: 0.13 }, { n: 'cbowl', x: '84%', y: '24%', size: 52, rot: 10, o: 0.18 },
  { n: 'cwrap', x: '4%', y: '27%', size: 46, rot: 18, o: 0.15 }, { n: 'cdrop', x: '58%', y: '33%', size: 34, rot: -10, o: 0.12 },
  { n: 'ccombo', x: '20%', y: '44%', size: 50, rot: -12, o: 0.17 }, { n: 'cburger', x: '78%', y: '48%', size: 44, rot: 16, o: 0.13 },
  { n: 'cbowl', x: '6%', y: '62%', size: 48, rot: 8, o: 0.15 }, { n: 'cfries', x: '48%', y: '64%', size: 42, rot: -16, o: 0.12 },
  { n: 'ccup', x: '82%', y: '70%', size: 50, rot: 12, o: 0.17 }, { n: 'cwrap', x: '26%', y: '80%', size: 44, rot: -6, o: 0.14 },
  { n: 'ccombo', x: '66%', y: '86%', size: 46, rot: 14, o: 0.15 }, { n: 'cdrop', x: '8%', y: '91%', size: 36, rot: -12, o: 0.12 },
];

function Doodle({ n, x, y, size, rot, o, i }: D & { i: number }) {
  const v = useLoop(5000 + (i % 5) * 900, i * 240);
  const dy = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -8, 0] });
  const r = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [`${rot}deg`, `${rot + 6}deg`, `${rot}deg`] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left: x as `${number}%`, top: y as `${number}%`, transform: [{ translateY: dy }, { rotate: r }] }}>
      <Image source={F[ORDER[i % ORDER.length]!]} style={{ width: size * 1.3, height: size * 1.3, opacity: Math.min(0.5, o * 2.6) }} resizeMode="contain" />
    </Animated.View>
  );
}

export function Aurora() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden', backgroundColor: theme.bg }}>
      <LinearGradient colors={['#1A1038', '#0C0A18', '#0A0814']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <Glow size={340} color="rgba(139,92,246,0.06)" top={-120} left={-80} dx={70} dy={50} duration={9000} delay={0} />
      <Glow size={300} color="rgba(60,130,220,0.05)" top={260} left={140} dx={-60} dy={60} duration={11000} delay={800} />
      <Glow size={260} color="rgba(255,113,133,0.03)" top={520} left={-90} dx={60} dy={-50} duration={13000} delay={400} />
      {DOODLES.map((d, i) => <Doodle key={i} {...d} i={i} />)}
    </View>
  );
}
