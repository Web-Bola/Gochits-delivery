import { Dimensions, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { AddButton, Photo } from './product';
import { discountPercent, type Product } from '../lib/menuData';

export const FRAME = Platform.OS === 'web' ? Math.min(430, Dimensions.get('window').width) : Dimensions.get('window').width;

/** Yellow strip with the logo that opens the discounted items (the "ფასდაკლებული პროდუქტები" banner from the demo). */
export function PromoBanner({ maxPercent, onPress }: { maxPercent: number; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={{ marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: colors.yellow }}>
      <Image source={require('../../assets/logo.png')} style={{ width: 54, height: 54 }} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: colors.ink }}>{ka.menu.promoTitle}</Text>
        <Text style={{ fontFamily: fontFamily.semibold, fontSize: 12.5, color: colors.ink }}>{ka.menu.promoSub.replace('{n}', String(maxPercent))}</Text>
      </View>
    </Pressable>
  );
}

/** Horizontal row of discounted products: photo card, red ribbon, add button, price with the old price struck through. */
export function DealsRow({ items, qtyOf, onAdd, onOpen }: { items: Product[]; qtyOf: (id: string) => number; onAdd: (i: Product) => void; onOpen: (i: Product) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 6 }}>
      {items.map((it) => {
        const off = discountPercent(it);
        return (
          <View key={it.id} style={{ width: 150, gap: 5 }}>
            <View style={{ width: 150, height: 112 }}>
              <Pressable accessibilityRole="button" accessibilityLabel={it.name} onPress={() => onOpen(it)} style={{ flex: 1 }}>
                <Photo path={it.image_path} rounded={16} style={{ flex: 1 }} />
              </Pressable>
              {off ? <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 10, backgroundColor: colors.red, borderTopRightRadius: 6, borderBottomRightRadius: 6, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 12 }}>-{off}%</Text></View> : null}
              <View style={{ position: 'absolute', right: 8, bottom: 8 }}><AddButton qty={qtyOf(it.id)} onPress={() => onAdd(it)} label={`${ka.menu.add}: ${it.name}`} /></View>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={it.name} onPress={() => onOpen(it)} style={{ gap: 3 }}>
              <Text numberOfLines={2} style={{ fontFamily: fontFamily.extrabold, fontSize: 13.5, color: theme.text, lineHeight: 18 }}>{it.name}</Text>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'baseline' }}>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: theme.text }}>{formatGel(it.price_tetri)}</Text>
                {it.old_price_tetri ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted, textDecorationLine: 'line-through' }}>{formatGel(it.old_price_tetri)}</Text> : null}
              </View>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}
