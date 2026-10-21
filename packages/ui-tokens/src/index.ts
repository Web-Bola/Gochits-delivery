/** Design tokens: marketplace palette (dark navy surfaces, emerald accent, coral CTA). */
export const colors = {
  /** Primary brand color (deep emerald). Fills and accents; put `onBrand` text/icons on top of it. */
  brand: '#0B8F6C',
  brandSoft: '#123A3A',
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

/** App theme (customer app screens): deep navy base, slightly lighter cards. Placeholder palette until the final brand name is chosen. */
export const theme = {
  bg: '#0B1424',
  surface: '#131E35',
  surface2: '#1B2A47',
  border: '#26375A',
  text: '#F1F5FB',
  muted: '#8C9BB5',
} as const;
