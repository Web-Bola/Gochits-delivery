import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View } from 'react-native';
import { colors } from '@gochits/ui-tokens';
import { Icon, type IconName } from './Icon';
import { ND, Pulse, Spin, useReduceMotion } from './fx';

const H = 190;
const ONB = colors.brand;

/** Round badge with an icon; optionally springs in once. */
function Disc({ icon, size = 92, spring = false }: { icon: IconName; size?: number; spring?: boolean }) {
  const v = useRef(new Animated.Value(spring ? 0 : 1)).current;
  useEffect(() => { if (spring) Animated.spring(v, { toValue: 1, friction: 5, tension: 90, useNativeDriver: ND }).start(); }, [spring, v]);
  return (
    <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(56,217,176,0.16)', borderWidth: 2, borderColor: 'rgba(125,242,214,0.7)', shadowColor: colors.brand, shadowOpacity: 0.6, shadowRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }}>
      <Icon name={icon} size={Math.round(size * 0.46)} color="#7DF2D6" strokeWidth={2.4} />
    </Animated.View>
  );
}

/** The courier badge drives from the business to the customer and loops. */
function Ride() {
  const [w, setW] = useState(0);
  const v = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (reduce) { v.setValue(0.5); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 3600, easing: Easing.inOut(Easing.quad), useNativeDriver: ND }),
      Animated.delay(500),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: ND }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v, reduce]);
  const R = 24; const B = 64; const track = Math.max(0, w - 2 * R - B);
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ alignSelf: 'stretch', height: B, justifyContent: 'center', paddingHorizontal: 20 }}>
      <View style={{ position: 'absolute', left: 20 + R, right: 20 + R, top: B / 2 - 1.5, height: 0, borderTopWidth: 3, borderStyle: 'dashed', borderColor: 'rgba(56,217,176,0.4)' }} />
      <View style={{ position: 'absolute', left: 20, top: (B - 2 * R) / 2, width: 2 * R, height: 2 * R, borderRadius: R, borderWidth: 3, borderColor: ONB, alignItems: 'center', justifyContent: 'center' }}><Icon name="store" size={20} color={ONB} /></View>
      <View style={{ position: 'absolute', right: 20, top: (B - 2 * R) / 2, width: 2 * R, height: 2 * R, borderRadius: R, borderWidth: 3, borderColor: ONB, alignItems: 'center', justifyContent: 'center' }}><Icon name="home" size={20} color={ONB} /></View>
      <Animated.View style={{ position: 'absolute', left: 20 + R, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, track] }) }] }}>
        <Disc icon="bike" size={B} />
      </Animated.View>
    </View>
  );
}

/** Brand-neutral order-tracking animation. Scenes: shop (received), cook (preparing), ready (waiting for pick-up), ride (on the road), home (delivered). */
export function TrackScene({ scene }: { scene: string }) {
  return (
    <View key={scene} style={{ height: H, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {scene === 'ride' ? <Ride /> : (
        <View style={{ width: 160, height: 160, alignItems: 'center', justifyContent: 'center' }}>
          {scene === 'shop' ? <><Pulse size={110} color={ONB} /><Pulse size={110} color={ONB} delay={1300} /><Disc icon="receipt" /></> : null}
          {scene === 'cook' ? (
            <>
              <Spin duration={9000} style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 3, borderStyle: 'dashed', borderColor: 'rgba(56,217,176,0.4)' }} />
              <Disc icon="bag" />
            </>
          ) : null}
          {scene === 'ready' ? <><Pulse size={110} color={ONB} /><Disc icon="bag" spring /></> : null}
          {scene === 'home' ? <><Pulse size={110} color={ONB} /><Disc icon="home" spring /></> : null}
        </View>
      )}
    </View>
  );
}
