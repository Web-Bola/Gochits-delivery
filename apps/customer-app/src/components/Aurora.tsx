import { Animated, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@gochits/ui-tokens';
import { useLoop } from './fx';

/** Animated brand backdrop (no photo): deep navy, three soft glows drifting slowly and faint rings. */
function Glow({ size, color, top, left, dx, dy, duration, delay }: { size: number; color: string; top: number; left: number; dx: number; dy: number; duration: number; delay: number }) {
  const v = useLoop(duration, delay);
  const x = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dx, 0] });
  const y = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, dy, 0] });
  const s = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.15, 1] });
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', top, left, width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ translateX: x }, { translateY: y }, { scale: s }] }} />;
}

export function Aurora() {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden', backgroundColor: theme.bg }}>
      <LinearGradient colors={['#0B2233', '#08131F', '#060E18']} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
      <Glow size={340} color="rgba(56,217,176,0.16)" top={-120} left={-80} dx={70} dy={50} duration={9000} delay={0} />
      <Glow size={300} color="rgba(60,130,220,0.14)" top={260} left={140} dx={-60} dy={60} duration={11000} delay={800} />
      <Glow size={260} color="rgba(255,113,133,0.07)" top={520} left={-90} dx={60} dy={-50} duration={13000} delay={400} />
      {[260, 400, 540].map((d, i) => (
        <View key={d} style={{ position: 'absolute', top: 90 - d / 2 + 60, left: '50%', marginLeft: -d / 2, width: d, height: d, borderRadius: d / 2, borderWidth: 1, borderColor: `rgba(125,242,214,${0.09 - i * 0.025})` }} />
      ))}
    </View>
  );
}
