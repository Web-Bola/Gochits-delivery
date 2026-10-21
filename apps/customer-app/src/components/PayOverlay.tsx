import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Icon } from './Icon';
import { Backdrop, Button, CtaBar } from './ui';
import { art } from '../lib/art';
import { ND } from './fx';

export type PayPhase = 'processing' | 'ok' | 'fail';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const BURST = ['#38D9B0', '#FF7185', '#F5C66B', '#7DF2D6'];

/** Full-screen payment result: spinner while the provider answers, then ripple + tick + confetti (success) or shake + cross (failure). */
export function PayOverlay({ phase, amount, number, count, onTrack, onRetry, onMenu }: { phase: PayPhase; amount: string; number: string; count: number; onTrack: () => void; onRetry: () => void; onMenu: () => void }) {
  const reduce = false;
  const pop = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const tick = useRef(new Animated.Value(0)).current;
  const pulseRing = useRef(new Animated.Value(0)).current;
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
      pulseRing.setValue(0);
      Animated.timing(pulseRing, { toValue: 1, duration: 1200, delay: 150, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
      Animated.timing(burst, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: ND }).start();
    } else {
      Animated.sequence([-9, 9, -9, 9, 0].map((x) => Animated.timing(shake, { toValue: x, duration: 90, useNativeDriver: ND }))).start();
    }
  }, [phase, rise, tick, pulseRing, burst, shake]);

  const pieces = useMemo(() => Array.from({ length: 22 }, (_, k) => {
    const a = (k / 22) * Math.PI * 2; const d = 90 + (k % 4) * 35;
    return { x: Math.round(Math.cos(a) * d), y: Math.round(Math.sin(a) * d), r: (k * 47) % 360, c: BURST[k % 4] ?? colors.brand };
  }), []);

  const ok = phase === 'ok'; const fail = phase === 'fail'; const done = ok || fail;
  const title = phase === 'processing' ? ka.payment.processing : ok ? ka.payment.okTitle : ka.payment.failedTitle;
  const rise1 = phase === 'processing' ? {} : { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] };

  const heading = ok ? 'შეკვეთა\nმიღებულია!' : fail ? ka.payment.failedTitle : ka.payment.processing;
  const sub = ok ? 'შენი გემრიელი შეკვეთა\nგზაშია შენთან' : fail ? '' : `${amount} · №${number}`;
  return (
    <View accessibilityRole="alert" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 40 }}>
      <Backdrop source={art.success ?? undefined} fade={0.78}>
          {pieces.map((p, i) => (
            <Animated.View key={i} pointerEvents="none" style={{ position: 'absolute', left: '50%', top: '30%', width: 9, height: 9, borderRadius: 2, backgroundColor: p.c,
              opacity: burst.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 1, 0] }),
              transform: [{ translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.x] }) }, { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, p.y] }) }, { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.r}deg`] }) }] }} />
          ))}
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 24, alignItems: 'center' }}>
            <Image source={require('../../assets/zyro-logo.png')} style={{ width: 130, height: 60 }} resizeMode="contain" accessibilityLabel="ZYRO" />
            <View style={{ width: 150, height: 150, alignItems: 'center', justifyContent: 'center', marginTop: 34 }}>
              {[0, 1].map((k) => (
                <Animated.View key={k} pointerEvents="none" style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2, borderColor: colors.brand,
                  opacity: pulseRing.interpolate({ inputRange: [0, 0.15 + k * 0.1, 1], outputRange: [0, 0.6, 0] }),
                  transform: [{ scale: pulseRing.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.4 + k * 0.25] }) }] }} />
              ))}
              <Animated.View style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: fail ? 'rgba(255,113,133,0.14)' : 'rgba(56,217,176,0.16)', borderWidth: 2, borderColor: fail ? 'rgba(255,113,133,0.7)' : 'rgba(125,242,214,0.7)', alignItems: 'center', justifyContent: 'center', shadowColor: colors.brand, shadowOpacity: 0.7, shadowRadius: 30, transform: [{ scale: pop }] }}>
{phase === 'processing' ? (
                  <>
                    <Animated.View style={{ position: 'absolute', transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
                      <Svg width={132} height={132} viewBox="0 0 80 80"><Circle cx={40} cy={40} r={37} fill="none" stroke="#7DF2D6" strokeWidth={3} strokeLinecap="round" strokeDasharray="70 170" /></Svg>
                    </Animated.View>
                    <Animated.View style={{ position: 'absolute', transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] }) }] }}>
                      <Svg width={104} height={104} viewBox="0 0 80 80"><Circle cx={40} cy={40} r={37} fill="none" stroke="#38D9B0" strokeWidth={2} strokeLinecap="round" strokeDasharray="30 200" opacity={0.7} /></Svg>
                    </Animated.View>
                    <Icon name="card" size={44} color="#7DF2D6" />
                  </>
                ) : fail ? <Icon name="x" size={56} color={colors.red} strokeWidth={3.5} /> :                 <Svg width={70} height={70} viewBox="0 0 80 80"><AnimatedPath d="M18 42l15 15 30-32" fill="none" stroke="#7DF2D6" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="80" strokeDashoffset={tick.interpolate({ inputRange: [0, 1], outputRange: [80, 0] })} /></Svg>}
              </Animated.View>
            </View>
            <Animated.View style={[{ alignSelf: 'stretch', alignItems: 'center', gap: 10, marginTop: 22 }, rise1]}>
              <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 38, color: theme.text, textAlign: 'center' }}>{heading}</Text>
              {sub ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: theme.muted, textAlign: 'center' }}>{sub}</Text> : null}
              {fail ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 13, color: theme.text, lineHeight: 20, backgroundColor: 'rgba(255,113,133,0.14)', borderWidth: 1, borderColor: 'rgba(255,113,133,0.4)', borderRadius: 14, padding: 12, textAlign: 'center' }}>{ka.payment.failedWhy}</Text> : null}
              {ok ? (
              <View style={{ alignSelf: 'stretch', backgroundColor: 'rgba(11,24,39,0.88)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(56,217,176,0.16)', marginTop: 8, paddingHorizontal: 16 }}>
                {[['receipt', 'შეკვეთის ნომერი', `#${number}`], ['bag', 'პროდუქტი', `${count} ${ka.cart.items}`], ['wallet', 'ჯამი', amount]].map(([ic, k, v], i, arr) => (
                  <View key={String(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: theme.border }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(56,217,176,0.12)', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic as 'receipt'} size={22} color={colors.brand} /></View>
                    <View><Text style={{ fontFamily: fontFamily.regular, fontSize: 12.5, color: theme.muted }}>{k}</Text><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{v}</Text></View>
                  </View>
                ))}
              </View>
              ) : null}
            </Animated.View>
            <View style={{ flex: 1 }} />
            {ok ? (
              <View style={{ alignSelf: 'stretch', gap: 8 }}>
                <CtaBar icon="bike" title="შეკვეთის თვალყური" onPress={onTrack} />
                <Pressable accessibilityRole="button" onPress={onMenu} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.muted }}>მთავარ გვერდზე დაბრუნება</Text>
                </Pressable>
              </View>
            ) : fail ? (
              <View style={{ alignSelf: 'stretch', gap: 8 }}>
                <Button title={ka.payment.retry} onPress={onRetry} arrow />
                <Button variant="outline" title={ka.orders.toMenu} onPress={onMenu} />
              </View>
            ) : null}
          </View>
      </Backdrop>
    </View>
  );
}
