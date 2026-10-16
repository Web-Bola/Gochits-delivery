import { useRef, useState } from 'react';
import { Animated, PanResponder, View } from 'react-native';
import { colors, fontFamily } from '@gochits/ui-tokens';
import { Icon } from './ui';

/** Slide-to-confirm: drag the knob to the end. Hard to trigger by accident. */
export function Slide({ label, onConfirm, busy }: { label: string; onConfirm: () => void; busy?: boolean }) {
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(0, w - 60);
  const state = useRef({ max, busy, onConfirm });
  state.current = { max, busy, onConfirm };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !state.current.busy,
    onMoveShouldSetPanResponder: () => !state.current.busy,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => x.setValue(Math.min(Math.max(0, g.dx), state.current.max)),
    onPanResponderRelease: (_, g) => {
      if (state.current.max > 0 && g.dx > state.current.max * 0.8) { Animated.timing(x, { toValue: state.current.max, duration: 120, useNativeDriver: false }).start(() => { state.current.onConfirm(); setTimeout(() => x.setValue(0), 600); }); }
      else Animated.timing(x, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    },
  })).current;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 60, borderRadius: 30, backgroundColor: '#2E9E5B', justifyContent: 'center' }}>
      <Animated.Text style={{ position: 'absolute', alignSelf: 'center', color: '#fff', fontFamily: fontFamily.extrabold, fontSize: 15, opacity: x.interpolate({ inputRange: [0, Math.max(1, max * 0.6)], outputRange: [1, 0], extrapolate: 'clamp' }) }}>{busy ? '…' : label}</Animated.Text>
      <Animated.View {...pan.panHandlers} style={{ position: 'absolute', left: 4, width: 52, height: 52, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', transform: [{ translateX: x }] }}>
        <Icon name="check" color="#2E9E5B" size={24} />
      </Animated.View>
    </View>
  );
}
