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
  const rise1 = { opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] };

  if (ok) {
    return (
      <View accessibilityRole="alert" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 40 }}>
        <Backdrop source={art.success ?? undefined} fade={0.75}>
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
              <Animated.View style={{ width: 132, height: 132, borderRadius: 66, backgroundColor: 'rgba(56,217,176,0.16)', borderWidth: 2, borderColor: 'rgba(125,242,214,0.7)', alignItems: 'center', justifyContent: 'center', shadowColor: colors.brand, shadowOpacity: 0.7, shadowRadius: 30, transform: [{ scale: pop }] }}>
                <Svg width={70} height={70} viewBox="0 0 80 80"><AnimatedPath d="M18 42l15 15 30-32" fill="none" stroke="#7DF2D6" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="80" strokeDashoffset={tick.interpolate({ inputRange: [0, 1], outputRange: [80, 0] })} /></Svg>
              </Animated.View>
            </View>
            <Animated.View style={[{ alignSelf: 'stretch', alignItems: 'center', gap: 10, marginTop: 22 }, rise1]}>
              <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 38, color: theme.text, textAlign: 'center' }}>შეკვეთა{'\n'}მიღებულია!</Text>
              <Text style={{ fontFamily: fontFamily.regular, fontSize: 15, lineHeight: 22, color: theme.muted, textAlign: 'center' }}>შენი გემრიელი შეკვეთა{'\n'}გზაშია შენთან</Text>
              <View style={{ alignSelf: 'stretch', backgroundColor: 'rgba(11,24,39,0.88)', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(56,217,176,0.16)', marginTop: 8, paddingHorizontal: 16 }}>
                {[['receipt', 'შეკვეთის ნომერი', `#${number}`], ['bag', 'პროდუქტი', `${count} ${ka.cart.items}`], ['wallet', 'ჯამი', amount]].map(([ic, k, v], i, arr) => (
                  <View key={String(k)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: i < arr.length - 1 ? 1 : 0, borderBottomColor: theme.border }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(56,217,176,0.12)', alignItems: 'center', justifyContent: 'center' }}><Icon name={ic as 'receipt'} size={22} color={colors.brand} /></View>
                    <View><Text style={{ fontFamily: fontFamily.regular, fontSize: 12.5, color: theme.muted }}>{k}</Text><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 17, color: theme.text }}>{v}</Text></View>
                  </View>
                ))}
              </View>
            </Animated.View>
            <View style={{ flex: 1 }} />
            <View style={{ alignSelf: 'stretch', gap: 8 }}>
              <CtaBar icon="bike" title="შეკვეთის თვალყური" onPress={onTrack} />
              <Pressable accessibilityRole="button" onPress={onMenu} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.muted }}>მთავარ გვერდზე დაბრუნება</Text>
              </Pressable>
            </View>
          </View>
        </Backdrop>
      </View>
    );
  }

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
          <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
            {[0, 1].map((k) => (
              <Animated.View key={k} pointerEvents="none" style={{ position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: colors.brand,
                opacity: pulseRing.interpolate({ inputRange: [0, 0.15 + k * 0.1, 1], outputRange: [0, 0.7, 0] }),
                transform: [{ scale: pulseRing.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.5 + k * 0.25] }) }] }} />
            ))}
            <Animated.View style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center', transform: [{ scale: pop }] }}>
              <Svg width={44} height={44} viewBox="0 0 80 80"><AnimatedPath d="M20 42l14 14 28-30" fill="none" stroke={colors.onBrand} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="80" strokeDashoffset={tick.interpolate({ inputRange: [0, 1], outputRange: [80, 0] })} /></Svg>
            </Animated.View>
          </View>
        ) : (
          <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ position: 'absolute', transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
              <Svg width={96} height={96} viewBox="0 0 80 80">
                <Circle cx={40} cy={40} r={34} fill={fail ? colors.red : 'none'} stroke={fail ? colors.red : theme.border} strokeWidth={5} />
                {!done ? <Circle cx={40} cy={40} r={34} fill="none" stroke={colors.brand} strokeWidth={5} strokeLinecap="round" strokeDasharray="60 160" /> : null}
              </Svg>
            </Animated.View>
            {phase === 'processing' ? <Icon name="card" size={34} color={colors.brand} /> : <Icon name="x" size={38} color={colors.white} strokeWidth={3.5} />}
          </View>
        )}

        <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 22, color: theme.text, textAlign: 'center', marginTop: 4 }}>{title}</Text>
        <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.muted, textAlign: 'center' }}>{amount} · №{number}</Text>

        {done ? (
          <Animated.View style={[{ alignSelf: 'stretch', gap: 10, marginTop: 6 }, rise1]}>
            {ok ? (
              <>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.muted, textAlign: 'center' }}>{ka.payment.okSub}</Text>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }}><Icon name="check" size={15} color={colors.brand} /><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: theme.text }}>{ka.payment.paidChip}</Text></View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.surface2, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 }}><Icon name="bag" size={15} color={colors.brand} /><Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: theme.text }}>{count} {ka.cart.items}</Text></View>
                </View>
                <Button title="შეკვეთის თვალყური" onPress={onTrack} />
                <Button variant="outline" title="მთავარ გვერდზე დაბრუნება" onPress={onMenu} />
              </>
            ) : (
              <>
                <Text style={{ fontFamily: fontFamily.regular, fontSize: 13, color: theme.text, lineHeight: 20, backgroundColor: 'rgba(232,85,61,0.14)', borderWidth: 1, borderColor: 'rgba(232,85,61,0.4)', borderRadius: 14, padding: 12 }}>{ka.payment.failedWhy}</Text>
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
