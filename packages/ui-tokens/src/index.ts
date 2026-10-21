/** Design tokens: neutral marketplace palette (cream, deep emerald, coral). */
export const colors = {
  /** Primary brand color (deep emerald). Fills and accents; put `onBrand` text/icons on top of it. */
  brand: '#0E6B57',
  brandSoft: '#D9EBE5',
  onBrand: '#FFFFFF',
  /** Warm coral: main call-to-action buttons and error states. */
  red: '#E8553D',
  cream: '#FBF7F0',
  sand: '#E4DACB',
  muted: '#66716B',
  orange: '#F2A33A',
  white: '#FFFFFF',
} as const;

export const radius = { card: 22, sheet: 32, pill: 999, input: 16 } as const;
export const spacing = { screen: 20, gap: 12 } as const;
export const minTouch = 44;
export const fontFamily = { regular: 'NotoSansGeorgian_400Regular', semibold: 'NotoSansGeorgian_600SemiBold', extrabold: 'NotoSansGeorgian_800ExtraBold' } as const;

/** Dark app theme (customer app screens). Splash and login keep the yellow brand look. Our own choice, not official brand rules. */
/** Light app theme (customer app screens): cream base, white cards, deep-green text. Placeholder palette until the final brand name is chosen. */
export const theme = {
  bg: '#FBF7F0',
  surface: '#FFFFFF',
  surface2: '#F2ECE1',
  border: '#E4DACB',
  text: '#1B2420',
  muted: '#66716B',
} as const;
