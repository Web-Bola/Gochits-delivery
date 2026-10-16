import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { ka } from '@gochits/i18n';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';

const TABS = [
  { path: '/menu', icon: '🍔', label: ka.tabs.menu },
  { path: '/orders', icon: '🧾', label: ka.tabs.orders },
  { path: '/profile', icon: '👤', label: ka.tabs.profile },
] as const;

/** Bottom navigation shown on the three main screens. */
export function TabBar() {
  const router = useRouter();
  const path = usePathname();
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border, paddingBottom: 6, paddingTop: 6 }}>
      {TABS.map((t) => {
        const on = path === t.path;
        return (
          <Pressable key={t.path} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => !on && router.replace(t.path)}
            style={{ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <View style={{ backgroundColor: on ? colors.yellow : 'transparent', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 3 }}>
              <Text style={{ fontSize: 18 }}>{t.icon}</Text>
            </View>
            <Text style={{ fontFamily: on ? fontFamily.extrabold : fontFamily.semibold, fontSize: 11, color: on ? colors.yellow : theme.muted }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
