/** ZYRO design tokens. Change colours, radii and type here and every app follows. */
export const colors = {
  /** Mint primary: fills, active states. Put `onBrand` text/icons on top of it. */
  brand: '#FF7A1A',
  brandPressed: '#F26A0C',
  brandSoft: '#3A2210',
  /** Dark navy for text/icons that sit on mint. */
  onBrand: '#1A0F05',
  /** Errors, discounts, destructive actions. */
  red: '#FF7185',
  success: '#43D6A0',
  orange: '#F5C66B',
  white: '#FFFFFF',
  cream: '#0B0907',
  sand: '#33281F',
  muted: '#CDBFB5',
} as const;

export const radius = { card: 20, sheet: 28, pill: 999, input: 14 } as const;
export const spacing = { screen: 20, gap: 12 } as const;
export const minTouch = 44;
export const fontFamily = { regular: 'NotoSansGeorgian_400Regular', semibold: 'NotoSansGeorgian_600SemiBold', extrabold: 'NotoSansGeorgian_800ExtraBold' } as const;

/** Type scale (size / line height). */
export const type = { h1: [32, 40], h2: [24, 32], h3: [20, 28], bodyL: [16, 24], body: [14, 20], small: [12, 16] } as const;

/** App theme: deep navy base, lighter navy cards. */
export const theme = {
  bg: '#0B0907',
  surface: '#161210',
  surface2: '#211A15',
  border: '#33281F',
  text: '#FFF8F3',
  muted: '#CDBFB5',
} as const;
