import { memo } from 'react';
import { Image, Pressable, Text, View, type ViewStyle } from 'react-native';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, radius, theme } from '@gochits/ui-tokens';
import { Bump, FloatUp, PressScale } from './fx';
import { menuImages } from '../lib/menuImages';
import { discountPercent, type Product } from '../lib/menuData';
import { Icon } from './Icon';

export function photoOf(path: string | null) { return path ? menuImages[path] : undefined; }

/** Square-ish photo or a quiet placeholder. */
export function Photo({ path, style, rounded = 14 }: { path: string | null; style?: ViewStyle; rounded?: number }) {
  const img = photoOf(path);
  return (
    <View style={[{ backgroundColor: theme.surface2, borderRadius: rounded, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {img ? <Image source={img} style={{ width: '100%', height: '100%' }} resizeMode="cover" /> : <Image source={require('../../assets/logo.png')} style={{ width: '70%', height: '70%', opacity: 0.35 }} resizeMode="contain" />}
    </View>
  );
}

export function Heart({ on, onPress, size = 36, dark }: { on: boolean; onPress: () => void; size?: number; dark?: boolean }) {
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={on ? ka.menu.favRemove : ka.menu.favAdd} accessibilityState={{ selected: on }} onPress={onPress} scaleTo={0.8}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: dark ? 'rgba(20,11,10,0.55)' : 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}>
      <Bump value={on ? 1 : 0}><Text style={{ fontSize: size * 0.5, color: on ? colors.red : dark ? colors.white : colors.ink }}>{on ? '♥' : '♡'}</Text></Bump>
    </PressScale>
  );
}

/** Round − 1 + control. */
export function Stepper({ value, onMinus, onPlus, min = 0, max = 50, tone = 'dark' }: { value: number; onMinus: () => void; onPlus: () => void; min?: number; max?: number; tone?: 'dark' | 'light' }) {
  const bg = tone === 'dark' ? theme.surface2 : '#FFF1BF';
  const fg = tone === 'dark' ? theme.text : colors.ink;
  const btn = (label: string, fn: () => void, disabled: boolean, a11y: string, accent: boolean) => (
    <PressScale accessibilityRole="button" accessibilityLabel={a11y} accessibilityState={{ disabled }} disabled={disabled} onPress={fn} scaleTo={0.85}
      style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: accent ? colors.yellow : tone === 'dark' ? theme.border : colors.white, opacity: disabled ? 0.4 : 1 }}>
      <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 22, color: accent ? colors.ink : fg, marginTop: -2 }}>{label}</Text>
    </PressScale>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: 24, padding: 3 }}>
      {btn('−', onMinus, value <= min, 'შემცირება', false)}
      <Bump value={value}><Text style={{ minWidth: 28, textAlign: 'center', fontFamily: fontFamily.extrabold, fontSize: 16, color: fg }}>{value}</Text></Bump>
      {btn('+', onPlus, value >= max, 'გაზრდა', true)}
    </View>
  );
}

interface CardProps {
  item: Product; width: number | `${number}%`; qty: number; fav: boolean; bumped: number;
  onAdd: () => void; onOpen: () => void; onFav: () => void;
}

/** Menu card: photo, discount badge, heart, quantity badge, round add button. Sold-out items are dimmed and cannot be added. */
export function ProductCard({ item, width, qty, fav, bumped, onAdd, onOpen, onFav }: CardProps) {
  const off = discountPercent(item);
  const sold = !item.available;
  return (
    <View style={{ width, backgroundColor: theme.surface, borderRadius: radius.card, overflow: 'hidden', borderWidth: 1, borderColor: qty > 0 ? colors.yellow : theme.border }}>
      <View style={{ height: 130 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={onOpen} style={{ flex: 1, opacity: sold ? 0.45 : 1 }}>
          <Photo path={item.image_path} rounded={0} style={{ flex: 1 }} />
        </Pressable>
        {off && !sold ? <View style={{ position: 'absolute', left: 8, top: 8, backgroundColor: colors.yellow, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 }}><Text style={{ color: colors.ink, fontFamily: fontFamily.extrabold, fontSize: 12 }}>-{off}%</Text></View> : null}
        <View style={{ position: 'absolute', right: 8, top: 8 }}><Heart on={fav} onPress={onFav} size={32} dark /></View>
        {sold ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 8, bottom: 8, backgroundColor: theme.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: theme.text, fontFamily: fontFamily.extrabold, fontSize: 12 }}>{ka.menu.soldOut}</Text>
          </View>
        ) : (
          <View style={{ position: 'absolute', right: 8, bottom: 8 }}>
            <PressScale accessibilityRole="button" accessibilityLabel={`${ka.menu.add}: ${item.name}`} onPress={onAdd} scaleTo={0.8}
              style={{ minWidth: 44, height: 44, paddingHorizontal: qty > 0 ? 12 : 0, borderRadius: 22, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 8 }}>
              <Text style={{ color: colors.white, fontSize: qty > 0 ? 16 : 24, fontFamily: fontFamily.extrabold, marginTop: qty > 0 ? 0 : -2 }}>{qty > 0 ? `${qty} +` : '+'}</Text>
            </PressScale>
            <FloatUp trigger={bumped} />
          </View>
        )}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}`} onPress={onOpen} style={{ padding: 12, gap: 3, opacity: sold ? 0.5 : 1 }}>
        <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{item.name}</Text>
        <Text numberOfLines={1} style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted }}>{item.description_ka ?? ' '}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 16, color: colors.yellow }}>{formatGel(item.price_tetri)}</Text>
          {item.old_price_tetri ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 12, color: theme.muted, textDecorationLine: 'line-through' }}>{formatGel(item.old_price_tetri)}</Text> : null}
        </View>
      </Pressable>
    </View>
  );
}


/** Red ribbon "-30%" on the corner of a photo (from the demo). */
export function Ribbon({ off }: { off: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 10, backgroundColor: colors.red, borderTopRightRadius: 6, borderBottomRightRadius: 6, paddingHorizontal: 9, paddingVertical: 3 }}>
      <Text style={{ color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 12 }}>-{off}%</Text>
    </View>
  );
}

/** White round add button; turns red and shows the quantity once the item is in the cart. */
export function AddButton({ qty, onPress, label, size = 36 }: { qty: number; onPress: () => void; label: string; size?: number }) {
  return (
    <PressScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} scaleTo={0.8}
      style={{ minWidth: size, height: size, paddingHorizontal: qty > 0 ? 8 : 0, borderRadius: size / 2, backgroundColor: qty > 0 ? colors.red : colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }}>
      {qty > 0 ? <Text style={{ color: colors.white, fontFamily: fontFamily.extrabold, fontSize: 15 }}>{qty}</Text> : <Icon name="plus" size={20} color={colors.ink} strokeWidth={2.4} />}
    </PressScale>
  );
}

/** One menu row from the demo: name, description and price on the left, photo with the add button on the right. */
function ProductRowImpl({ item, qty, bumped, onAdd, onOpen }: { item: Product; qty: number; bumped: number; onAdd: (p: Product) => void; onOpen: (p: Product) => void }) {
  const off = discountPercent(item);
  const sold = !item.available;
  return (
    <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border }}>
      <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => onOpen(item)} style={{ flex: 1, minWidth: 0, gap: 4, opacity: sold ? 0.5 : 1 }}>
        <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text, lineHeight: 21 }}>{item.name}</Text>
        {item.description_ka ? <Text numberOfLines={2} style={{ fontFamily: fontFamily.regular, fontSize: 13, color: theme.muted, lineHeight: 19 }}>{item.description_ka}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{formatGel(item.price_tetri)}</Text>
          {item.old_price_tetri ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 13, color: theme.muted, textDecorationLine: 'line-through' }}>{formatGel(item.old_price_tetri)}</Text> : null}
          {off && !sold ? <View style={{ backgroundColor: colors.yellow, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 1 }}><Text style={{ color: colors.ink, fontFamily: fontFamily.extrabold, fontSize: 12 }}>-{off}%</Text></View> : null}
          {sold ? <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 12, color: colors.red }}>{ka.menu.soldOut}</Text> : null}
        </View>
      </Pressable>
      <View style={{ width: 104, height: 104 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={item.name} onPress={() => onOpen(item)} style={{ flex: 1, opacity: sold ? 0.45 : 1 }}>
          <Photo path={item.image_path} rounded={14} style={{ flex: 1 }} />
        </Pressable>
        {off && !sold ? <Ribbon off={off} /> : null}
        {!sold ? (
          <View style={{ position: 'absolute', right: -6, bottom: -6 }}>
            <AddButton qty={qty} onPress={() => onAdd(item)} label={`${ka.menu.add}: ${item.name}`} />
            <FloatUp trigger={bumped} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export const ProductRow = memo(ProductRowImpl, (a, b) => a.item === b.item && a.qty === b.qty && a.bumped === b.bumped);


/** Soft dark gradient over a photo (stacked strips, so it works the same on phone and web without extra packages). */
export function Scrim({ side, height, max = 0.85 }: { side: 'top' | 'bottom'; height: number; max?: number }) {
  const n = 14;
  const strips = Array.from({ length: n }, (_, i) => {
    const t = side === 'bottom' ? (i + 1) / n : 1 - i / n;
    return <View key={i} style={{ flex: 1, backgroundColor: `rgba(20,11,10,${(max * t * t).toFixed(3)})` }} />;
  });
  return <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, [side]: 0, height }}>{strips}</View>;
}
