import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Icon } from './Icon';
import { Button } from './ui';
import { ND, useReduceMotion } from './fx';

export type PayPhase = 'processing' | 'ok' | 'fail';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const BURST = ['#FFCC02', '#D8141C', '#FFF4E0', '#F28C1E'];

/** Full-screen payment result: spinner while the provider answers, then burger drop + tick + confetti (success) or shake + cross (failure). */
export function PayOverlay({ phase, amount, number, count, onTrack, onRetry, onMenu }: { phase: PayPhase; amount: string; number: string; count: number; onTrack: () => void; onRetry: () => void; onMenu: () => void }) {
  const reduce = useReduceMotion();
  const pop = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const tick = useRef(new Animated.Value(0)).current;
  const drop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;

  useEffect(() => { Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: ND }).start(); }, [pop]);
  useEffect(() => {
    if (phase !== 'processing' || reduce) return;
    const l = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: ND }));
    l.start();
    return () => l.stop();
  }, [phase, reduce, spin]);
  useEffect(() => {
    if (phase === 'processing') return;
    rise.setValue(0);
    Animated.timing(rise, { toValue: 1, duration: 600, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
    if (phase === 'ok') {
      tick.setValue(0);
      Animated.timing(tick, { toValue: 1, duration: 500, delay: 350, useNativeDriver: false }).start();
      Animated.timing(drop, { toValue: 1, duration: 900, delay: 50, easing: Easing.bounce, useNativeDriver: ND }).start();
      Animated.timing(burst, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
    } else {
      Animated.sequence([-9, 9, -9, 9, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 90, useNativeDriver: ND }))).start();
    }
  }, [phase, rise, tick, drop, burst, shake]);

  const pieces = useMemo(() => Array.from({ length: 22 }, (_, k) => {
    const a = (k / 22) * Math.PI * 2; const d = 90 + (k % 4) * 35;
    return { x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d), r: (k * 47) % 360, c: BURST[k % 4] ?? colors.yellow };
  }), []);

  const ok = phase === 'ok'; const fail = phase === 'fail'; const done = ok || fail;
  const title = phase === 'processing' ? ka.payment.processing : ok ? ka.payment.okTitle : ka.payment.failedTitle;
  const rise1 = { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] };

  return (
    <View accessibilityRole="alert" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 40, backgroundColor: 'rgba(10,6,5,0.86)', alignItems: 'center', justifyContent: 'center', padding: 22 }}>
      <Animated.View style={{ width: '100%', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 26, paddingHorizontal: 22, paddingTop: 28, paddingBottom: 22, alignItems: 'center', gap: 10, overflow: 'hidden',
        opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }, { translateX: shake }] }}>
        {ok ? pieces.map((p, i) => (
          <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '38%', width: 9, height: 9, borderRadius: 2, backgroundColor: p.c,
            opacity: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
            transform: [{ translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) }, { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.y] }) }, { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.r}deg`] }) }] }} />
        )) : null}

        {ok ? (
          <Animated.View style={{ height: 96, transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-240, 0] }) }, { rotate: drop.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '0deg'] }) }] }}>
            <Svg width={96} height={96} viewBox="0 0 100 100">
              <Path d="M14 52a36 28 0 0 1 72 0z" fill="#F28C1E" stroke="#1A0D0B" strokeWidth={4} strokeLinejoin="round" />
              <Path d="M12 58q8-6 16 0t16 0t16 0t16 0t12 -2v8H12z" fill="#6DAA4F" stroke="#1A0D0B" strokeWidth={3} />
              <Rect x={14} y={68} width={72} height={11} rx={5.5} fill="#5A2E1A" stroke="#1A0D0B" strokeWidth={4} />
              <Path d="M16 82h68q-2 10-12 10H28q-10 0-12-10z" fill="#F28C1E" stroke="#1A0D0B" strokeWidth={4} strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        ) : (
          <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ position: 'absolute', transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
              <Svg width={96} height={96} viewBox="0 0 80 80">
                <Circle cx={40} cy={40} r={34} fill={fail ? colors.red : 'none'} stroke={fail ? colors.red : theme.border} strokeWidth={5} />
                {!done ? <Circle cx={40} cy={40} r={34} fill="none" stroke={colors.yellow} strokeWidth={5} strokeLinecap="round" strokeDasharray="60 160" /> : null}
              </Svg>
            </Animated.View>
            {phase === 'processing' ? <Icon name="card" size={34} color={colors.yellow} /> : <Icon name="x" size={38} color={colors.white} strokeWidth={3.5} />}
          </View>
        )}

        {ok ? (
          <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: colors.yellow, alignItems: 'center', justifyContent: 'center', marginTop: -6 }}>
            <Svg width={30} height={30} viewBox="0 0 80 80"><AnimatedPath d="M20 42l14 14 28-30" fill="none" stroke={colors.ink} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="80" strokeDashoffset={tick.interpolate({ inputRange: [0, 1], outputRange: [80, 0] })} /></Svg>
          </View>
        ) : null}

        <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 22, color: theme.text, textAlign: 'center', marginTop: 4 }}>{title}</Text>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.muted, textAlign: 'center' }}>{amount} · №{number}</Text>

        {done ? (
          <Animated.View style={[{ alignSelf: 'stretch', gap: 10, marginTop: 6 }, rise1]}>
            {ok ? (
              <>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.muted, textAlign: 'center' }}>{ka.payment.okSub}</Text>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }}><Icon name="check" size={15} color={colors.yellow} /><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: theme.text }}>{ka.payment.paidChip}</Text></View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }}><Icon name="bag" size={15} color={colors.yellow} /><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: theme.text }}>{count} {ka.cart.items}</Text></View>
                </View>
                <Button title={ka.payment.viewOrder} onPress={onTrack} />
              </>
            ) : (
              <>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: 13, color: theme.text, lineHeight: 20, backgroundColor: 'rgba(216,20,28,0.14)', borderWidth: 1, borderColor: 'rgba(216,20,28,0.4)', borderRadius: 14, padding: 12 }}>{ka.payment.failedWhy}</Text>
                <Button title={ka.payment.retry} onPress={onRetry} />
                <Button variant="outline" title={ka.orders.toMenu} onPress={onMenu} />
              </>
            )}
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}
