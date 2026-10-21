import { Image, Text, View } from 'react-native';
import { colors, fontFamily, theme } from '@gochits/ui-tokens';
import { hasBundledArt, initial, type Merchant } from '../lib/merchants';
import { merchantArt } from '../lib/art';

export function MerchantLogo({ m, size }: { m: Pick<Merchant, 'slug' | 'name'>; size: number }) {
  const art = merchantArt(m.slug);
  if (art) return <Image source={art.logo} style={{ width: size, height: size, borderRadius: size * 0.26, borderWidth: 2, borderColor: 'rgba(56,217,176,0.35)' }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.26, backgroundColor: hasBundledArt(m) ? colors.brand : '#F7FAFC', borderWidth: 2, borderColor: 'rgba(56,217,176,0.35)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {hasBundledArt(m) ? <Image source={require('../../assets/logo.png')} style={{ width: size * 0.74, height: size * 0.52 }} resizeMode="contain" /> : <Text style={{ fontFamily: fontFamily.extrabold, fontSize: size * 0.42, color: '#0B1724' }}>{initial(m.name)}</Text>}
    </View>
  );
}
