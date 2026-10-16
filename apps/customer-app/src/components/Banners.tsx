import { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Platform, Pressable, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { PressScale, useReduceMotion } from './fx';
import { photoOf } from './product';
import { discountPercent, type Product } from '../lib/menuData';

export const FRAME = Platform.OS === 'web' ? Math.min(430, Dimensions.get('window').width) : Dimensions.get('window').width;

/** Auto-sliding banner of discounted products that have a photo. Only name, price and the real old/new price difference are shown. */
export function Banners({ items, onAdd, onOpen }: { items: Product[]; onAdd: (i: Product) => void; onOpen: (i: Product) => void }) {
  const ref = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const reduce = useReduceMotion();
  const w = FRAME - 40;
  useEffect(() => {
    if (reduce || items.length < 2) return;
    const t = setInterval(() => setPage((p) => {
      const n = (p + 1) % items.length;
      ref.current?.scrollTo({ x: n * (w + 12), animated: true });
      return n;
    }), 4200);
    return () => clearInterval(t);
  }, [items.length, reduce, w]);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / (w + 12)));
  return (
    <View style={{ gap: 10 }}>
      <ScrollView ref={ref} horizontal snapToInterval={w + 12} decelerationRate="fast" showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {items.map((it) => {
          const off = discountPercent(it);
          const img = photoOf(it.image_path);
          return (
            <View key={it.id} style={{ width: w, height: 180, borderRadius: 26, overflow: 'hidden', backgroundColor: theme.surface2 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={it.name} onPress={() => onOpen(it)} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} />
              {img ? <Image source={img} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" /> : null}
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(20,11,10,0.55)' }} />
              <View pointerEvents="box-none" style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
                {off ? <View style={{ alignSelf: 'flex-start', backgroundColor: colors.yellow, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 }}><Text style={{ color: colors.ink, fontFamily: fontFamily.extrabold, fontSize: 14 }}>-{off}%</Text></View> : <View />}
                <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <View pointerEvents="none" style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 22, color: colors.white }}>{it.name}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline' }}>
                      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 18, color: colors.yellow }}>{formatGel(it.price_tetri)}</Text>
                      {it.old_price_tetri ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 13, color: '#D9C9BE', textDecorationLine: 'line-through' }}>{formatGel(it.old_price_tetri)}</Text> : null}
                    </View>
                  </View>
                  <PressScale accessibilityRole="button" accessibilityLabel={`${ka.menu.add}: ${it.name}`} onPress={() => onAdd(it)} scaleTo={0.85}
                    style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.white, fontSize: 26, fontFamily: fontFamily.extrabold, marginTop: -2 }}>+</Text>
                  </PressScale>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {items.map((_, i) => <View key={i} style={{ width: i === page ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === page ? colors.yellow : theme.border }} />)}
      </View>
    </View>
  );
}
