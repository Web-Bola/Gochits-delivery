import { Animated, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@gochits/ui-tokens';
import { useLoop } from './fx';
import { Icon } from './Icon';

/** Animated brand backdrop (no photo): deep navy, three soft glows drifting slowly and faint rings. */
function Glow({ size, color, top, left, dx, dy, duration, delay }: { size: number; color: string; top: number; left: number; dx: number; dy: number; duration: number; delay: number }) {
  const v = useLoop(duration, delay);
  const x = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dx, 0] });
  const y = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dy, 0] });
  const s = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] });
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top, left, width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ translateX: x }, { translateY: y }, { scale: s }] }} />;
}

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
      <Icon name={n} size={size} color={`rgba(125,242,214,${o})`} strokeWidth={1.6} />
    </Animated.View>
  );
}

export function Aurora() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden', backgroundColor: theme.bg }}>
      <LinearGradient colors={['#0B2233', '#08131F', '#060E18']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <Glow size={340} color="rgba(56,217,176,0.16)" top={-120} left={-80} dx={70} dy={50} duration={9000} delay={0} />
      <Glow size={300} color="rgba(60,130,220,0.14)" top={260} left={140} dx={-60} dy={60} duration={11000} delay={800} />
      <Glow size={260} color="rgba(255,113,133,0.07)" top={520} left={-90} dx={60} dy={-50} duration={13000} delay={400} />
      {DOODLES.map((d, i) => <Doodle key={i} {...d} i={i} />)}
    </View>
  );
}
