import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { FRAME } from './Banners';
import { ND, useReduceMotion } from './fx';
import { SvgMarkup } from './SvgMarkup';
import { SCENE_LAYERS, type SceneLayer } from './sceneLayers';

const H = 190;
const VB_W = 360;
const VB_H = 210;

/** One animated layer. Distances are in scene units (the 360x210 box) and scaled to pixels. */
function Layer({ layer, scale, reduce }: { layer: SceneLayer; scale: number; reduce: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce || layer.kind === 'static') { v.setValue(layer.kind === 'pop' ? 1 : 0); return; }
    const i = layer.i ?? 0;
    const loop = (ms: number, delay = 0, yoyo = false) => {
      const step = yoyo
        ? Animated.sequence([Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: ND }), Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: ND })])
        : Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.linear, useNativeDriver: ND });
      const run = Animated.sequence([Animated.delay(delay), Animated.loop(yoyo ? step : Animated.sequence([step, Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: ND })]))]);
      run.start();
      return run;
    };
    let a: Animated.CompositeAnimation | null = null;
    if (layer.kind === 'bob') a = loop(1200, 0, true);
    else if (layer.kind === 'ticket') a = loop(2800);
    else if (layer.kind === 'drop') a = loop(3600, i * 250);
    else if (layer.kind === 'steam') a = loop(2200, i * 500);
    else if (layer.kind === 'far') a = loop(6000);
    else if (layer.kind === 'road') a = loop(1000);
    else if (layer.kind === 'ridebob') a = loop(250, 0, true);
    else if (layer.kind === 'pop') { v.setValue(0); a = Animated.sequence([Animated.delay(200 + i * 300), Animated.spring(v, { toValue: 1, friction: 5, tension: 90, useNativeDriver: ND })]); a.start(); }
    return () => a?.stop();
  }, [layer.kind, layer.i, reduce, v]);

  let style: object = {};
  const s = scale;
  switch (layer.kind) {
    case 'bob': style = { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4 * s] }) }] }; break;
    case 'ticket': style = { opacity: v.interpolate({ inputRange: [0, 0.25, 0.7, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-30 * s, 170 * s] }) }] }; break;
    case 'drop': style = { opacity: v.interpolate({ inputRange: [0, 0.12, 0.22, 0.86, 1], outputRange: [0, 1, 1, 1, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 0.22, 1], outputRange: [-120 * s, 0, 0] }) }] }; break;
    case 'steam': style = { opacity: v.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.9, 0] }), transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16 * s, -14 * s] }) }] }; break;
    case 'far': style = { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -248 * s] }) }] }; break;
    case 'road': style = { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -70 * s] }) }] }; break;
    case 'ridebob': style = { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -3 * s] }) }] }; break;
    case 'pop': style = { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [24 * s, 0] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }; break;
    default: break;
  }
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, top: 0, width: '100%', height: H }, style]}>
      <SvgMarkup markup={layer.markup} viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" height={H} slice />
    </Animated.View>
  );
}

/** Animated order-tracking illustration: shop, kitchen, courier on the road, home. */
export function TrackScene({ scene }: { scene: string }) {
  const reduce = useReduceMotion();
  const scale = Math.max(FRAME / VB_W, H / VB_H);
  const layers = SCENE_LAYERS[scene] ?? SCENE_LAYERS.shop ?? [];
  return (
    <View style={{ height: H, overflow: 'hidden' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {layers.map((l, i) => <Layer key={`${scene}-${i}`} layer={l} scale={scale} reduce={reduce} />)}
    </View>
  );
}
