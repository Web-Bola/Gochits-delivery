import type { ImageSourcePropType } from 'react-native';

/**
 * Background food photos. Drop the files into assets/art/ and replace null with require('../../assets/art/<file>.jpg').
 * Screens already use these slots; with null they show the plain navy backdrop.
 */
export const art: Record<'splash' | 'login' | 'otp' | 'success' | 'payment' | 'banner', ImageSourcePropType | null> = {
  splash: null, login: null, otp: null, success: null, payment: null, banner: null,
};

/** Brand artwork per merchant slug (cover = wide header, card = square dish photo for list cards, logo). Merchants not listed here fall back to the initial-letter badge. */
export interface MerchantArt { cover: ImageSourcePropType; card: ImageSourcePropType; logo: ImageSourcePropType }
const R = {
  burger: { cover: require('../../assets/art/r/cover-burger-club.jpg'), card: require('../../assets/art/r/burger-classic.jpg'), logo: require('../../assets/art/r/logo-burger-club.jpg') },
  shavi: { cover: require('../../assets/art/r/cover-shavi-lomi.jpg'), card: require('../../assets/art/r/steak.jpg'), logo: require('../../assets/art/r/logo-shavi-lomi.jpg') },
  sushi: { cover: require('../../assets/art/r/cover-sushi.jpg'), card: require('../../assets/art/r/sushi.jpg'), logo: require('../../assets/art/r/logo-sushi-corner.jpg') },
  pizza: { cover: require('../../assets/art/r/cover-pizza.jpg'), card: require('../../assets/art/r/pizza.jpg'), logo: require('../../assets/art/r/logo-pizza-loro.jpg') },
  khink: { cover: require('../../assets/art/r/cover-khinkali.jpg'), card: require('../../assets/art/r/khachapuri.jpg'), logo: require('../../assets/art/r/logo-khinkali.jpg') },
} as const;
const bySlug: Record<string, MerchantArt> = {
  'burger-club': R.burger, 'shavi-lomi': R.shavi, 'sushi-corner': R.sushi, 'pizza-loro': R.pizza, 'khinkali-house': R.khink,
};
export const merchantArt = (slug: string): MerchantArt | null => bySlug[slug] ?? null;
