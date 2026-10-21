import { Platform, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { Icon } from './Icon';

const TABS = [
  { path: '/home', icon: 'home', label: 'მთავარი' },
  { path: '/orders', icon: 'receipt', label: ka.tabs.orders },
  { path: '/favorites', icon: 'heart', label: 'ფავორიტები' },
  { path: '/profile', icon: 'user', label: ka.tabs.profile },
] as const;

/** Bottom navigation shown on the three main screens (line icons, active one in the brand color). */
export function TabBar() {
  const router = useRouter();
  const path = usePathname();
  return (
    <View style={{ position: 'absolute', left: 10, right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(8,6,16,0.86)', borderWidth: 1, borderColor: 'rgba(139,92,246,0.20)', borderRadius: 28, height: 68, ...(Platform.OS === 'web' ? ({ backdropFilter: 'blur(18px)', boxShadow: '0 8px 24px rgba(0,0,0,.45)' } as object) : {}) }}>
      {TABS.map((t) => {
        const on = path === t.path;
        return (
          <Pressable key={t.path} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => !on && router.replace(t.path)}
            style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <Icon name={t.icon} size={22} color={on ? colors.brand : theme.muted} />
            <Text style={{ fontFamily: on ? fontFamily.extrabold : fontFamily.semibold, fontSize: 11, color: on ? colors.brand : theme.muted }}>{t.label}</Text>
            {on ? <View style={{ position: 'absolute', bottom: 2, width: 34, height: 3, borderRadius: 2, backgroundColor: colors.brand }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
