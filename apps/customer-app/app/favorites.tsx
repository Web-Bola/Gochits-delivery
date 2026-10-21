import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatGel } from '@gochits/shared';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { FadeIn, Header, StateView } from '../src/components/ui';
import { TabBar } from '../src/components/TabBar';
import { Icon } from '../src/components/Icon';
import { Photo } from '../src/components/product';
import { loadMenu, type Product } from '../src/lib/menuData';
import { useCart } from '../src/state/cart';
import { useFavorites } from '../src/state/favorites';

/** Favorite dishes, shown with the menu of the branch the customer is currently ordering from. */
export default function Favorites() {
  const router = useRouter();
  const { branch } = useCart();
  const fav = useFavorites();
  const reload = fav.reload;
  const [items, setItems] = useState<Product[] | null>(null);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  useEffect(() => {
    if (!branch || fav.ids.size === 0) { setItems([]); return; }
    loadMenu(branch.id).then((m) => setItems(m.products.filter((p) => fav.ids.has(p.id)))).catch(() => setItems([]));
  }, [branch, fav.ids]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="ფავორიტები" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 110 }}>
        {items && items.length === 0 ? (
          <StateView icon="heart" title="ფავორიტები ჯერ არ გაქვს" hint={branch ? 'დააჭირე გულს მენიუში კერძზე და აქ გამოჩნდება' : 'აირჩიე ბიზნესი მთავარ გვერდზე და მონიშნე საყვარელი კერძები'}
            actionTitle="მთავარ გვერდზე" onAction={() => router.replace('/home')} />
        ) : null}
        {(items ?? []).map((p, i) => (
          <FadeIn key={p.id} index={i}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.id } })}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.surface, borderRadius: 18, padding: 10, borderWidth: 1, borderColor: theme.border }}>
              <Photo path={p.image_path} style={{ width: 64, height: 64 }} rounded={14} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ fontFamily: fontFamily.extrabold, fontSize: 15, color: theme.text }}>{p.name}</Text>
                <Text style={{ fontFamily: fontFamily.extrabold, fontSize: 14, color: colors.brand }}>{formatGel(p.price_tetri)}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={ka.menu.favRemove} onPress={() => fav.toggle(p.id)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="heart" size={22} color={colors.red} fill={colors.red} />
              </Pressable>
            </Pressable>
          </FadeIn>
        ))}
      </ScrollView>
      <TabBar />
    </View>
  );
}
