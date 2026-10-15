import { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import { colors } from '@gochits/ui-tokens';
import { ND, Pulse, useReduceMotion } from './fx';

// Illustrated map (no real map yet: needs a maps key and courier GPS). Coordinates are in a 390x330 box.
const W = 390;
const H = 330;
type Pt = readonly [number, number];
const ROUTE: Pt[] = [[60, 300], [60, 220], [170, 220], [170, 140], [290, 140], [290, 90]];
const at = (i: number): Pt => ROUTE[i] ?? [0, 0];
const lens = ROUTE.slice(1).map((p, i) => Math.abs(p[0] - at(i)[0]) + Math.abs(p[1] - at(i)[1]));
const total = lens.reduce((a, b) => a + b, 0);
const cum = lens.reduce<number[]>((acc, l) => [...acc, (acc[acc.length - 1] ?? 0) + l / total], [0]);

const BLOCKS: [number, number, number, number][] = [[-10, 30, 130, 80], [150, 20, 110, 90], [300, 40, 100, 90], [-10, 150, 40, 50], [210, 200, 90, 130], [320, 180, 80, 120], [100, 250, 40, 60]];
const ROADS_H: [number, number, number][] = [[60, 170, 220], [170, 290, 140], [0, W, 270], [230, W, 90]];
const ROADS_V: [number, number, number][] = [[60, 220, 330], [170, 140, 220], [290, 0, 140], [120, 0, H]];

/** `phase`: 0 = at the restaurant, 1 = courier on the way, 2 = arrived. */
export function TrackMap({ phase }: { phase: 0 | 1 | 2 }) {
  const t = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    t.stopAnimation();
    if (phase === 0) { Animated.timing(t, { toValue: 0, duration: 400, useNativeDriver: false }).start(); return; }
    if (phase === 2 || reduce) { Animated.timing(t, { toValue: phase === 2 ? 1 : 0.5, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 0.9, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(t, { toValue: 0.1, duration: 9000, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [phase, reduce, t]);

  const x = t.interpolate({ inputRange: cum, outputRange: ROUTE.map((p) => p[0]) });
  const y = t.interpolate({ inputRange: cum, outputRange: ROUTE.map((p) => p[1]) });
  const road = { position: 'absolute', backgroundColor: colors.white, borderRadius: 11 } as const;
  const seg = (a: Pt, b: Pt, i: number) => (
    <View key={i} style={{ position: 'absolute', backgroundColor: colors.red, borderRadius: 3, left: Math.min(a[0], b[0]) - 3, top: Math.min(a[1], b[1]) - 3, width: Math.abs(a[0] - b[0]) + 6, height: Math.abs(a[1] - b[1]) + 6 }} />
  );
  return (
    <View style={{ height: H, backgroundColor: '#FFF1BF', alignItems: 'center', overflow: 'hidden' }} accessibilityLabel="რუკის ილუსტრაცია" accessibilityRole="image">
      <View style={{ width: W, height: H }}>
        {BLOCKS.map(([l, tp, w, h], i) => <View key={i} style={{ position: 'absolute', left: l, top: tp, width: w, height: h, borderRadius: 14, backgroundColor: '#FFE59A' }} />)}
        {ROADS_H.map(([a, b, yy], i) => <View key={`h${i}`} style={{ ...road, left: a - 11, width: b - a + 22, top: yy - 11, height: 22 }} />)}
        {ROADS_V.map(([xx, a, b], i) => <View key={`v${i}`} style={{ ...road, top: a - 11, height: b - a + 22, left: xx - 11, width: 22 }} />)}
        {ROUTE.slice(1).map((p, i) => seg(at(i), p, i))}
        <View style={{ position: 'absolute', left: at(0)[0] - 12, top: at(0)[1] - 12, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.ink, borderWidth: 4, borderColor: colors.white }} />
        <View style={{ position: 'absolute', left: at(5)[0] - 16, top: at(5)[1] - 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
          <Pulse size={32} color={colors.red} />
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.red, borderWidth: 4, borderColor: colors.white }} />
        </View>
        {phase > 0 && (
          <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: 44, height: 44, marginLeft: -22, marginTop: -22, borderRadius: 22, backgroundColor: colors.yellow, borderWidth: 4, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center',
            shadowColor: colors.ink, shadowOpacity: 0.3, shadowRadius: 10, transform: [{ translateX: x }, { translateY: y }] }}>
            <Text style={{ fontSize: 20 }}>🛵</Text>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
