/** ZYRO design tokens. Change colours, radii and type here and every app follows. */
export const colors = {
  /** Mint primary: fills, active states. Put `onBrand` text/icons on top of it. */
  brand: '#38D9B0',
  brandPressed: '#21BA96',
  brandSoft: '#16373A',
  /** Dark navy for text/icons that sit on mint. */
  onBrand: '#0B1724',
  /** Errors, discounts, destructive actions. */
  red: '#FF7185',
  success: '#43D6A0',
  orange: '#F5C66B',
  white: '#FFFFFF',
  cream: '#060E18',
  sand: '#1C3247',
  muted: '#ADBFCC',
} as const;

export const radius = { card: 20, sheet: 28, pill: 999, input: 14 } as const;
export const spacing = { screen: 20, gap: 12 } as const;
export const minTouch = 44;
export const fontFamily = { regular: 'NotoSansGeorgian_400Regular', semibold: 'NotoSansGeorgian_600SemiBold', extrabold: 'NotoSansGeorgian_800ExtraBold' } as const;

/** Type scale (size / line height). */
export const type = { h1: [32, 40], h2: [24, 32], h3: [20, 28], bodyL: [16, 24], body: [14, 20], small: [12, 16] } as const;

/** App theme: deep navy base, lighter navy cards. */
export const theme = {
  bg: '#060E18',
  surface: '#0B1827',
  surface2: '#12243A',
  border: '#1C3247',
  text: '#F7FAFC',
  muted: '#ADBFCC',
} as const;
