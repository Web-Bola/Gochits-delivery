import { Image, Text, View } from 'react-native';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { hasBundledArt, initial, type Merchant } from '../lib/merchants';

export function MerchantLogo({ m, size }: { m: Pick<Merchant, 'slug' | 'name'>; size: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.brand, borderWidth: 3, borderColor: theme.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {hasBundledArt(m) ? <Image source={require('../../assets/logo.png')} style={{ width: size * 0.74, height: size * 0.52 }} resizeMode="contain" /> : <Text style={{ fontFamily: fontFamily.extrabold, fontSize: size * 0.42, color: colors.onBrand }}>{initial(m.name)}</Text>}
    </View>
  );
}
