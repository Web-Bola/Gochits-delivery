import type { ImageSourcePropType } from 'react-native';

/**
 * Background food photos. Drop the files into assets/art/ and replace null with require('../../assets/art/<file>.jpg').
 * Screens already use these slots; with null they show the plain navy backdrop.
 */
export const art: Record<'splash' | 'login' | 'otp' | 'success' | 'payment' | 'banner', ImageSourcePropType | null> = {
  splash: require('../../assets/art/bg.jpg'), login: require('../../assets/art/bg.jpg'), otp: require('../../assets/art/bg.jpg'), success: require('../../assets/art/bg.jpg'), payment: require('../../assets/art/bg.jpg'), banner: null,
};
