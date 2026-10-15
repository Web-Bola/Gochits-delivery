/** Design tokens from the approved mockups. Colors are sampled from the logo; orange is our guess and needs owner approval. */
export const colors = {
  yellow: '#FFCC02',
  red: '#D8141C',
  ink: '#1A0D0B',
  cream: '#FFF8E1',
  yellowSoft: '#FFF1BF',
  sand: '#E8DDB8',
  muted: '#6b5a52',
  orange: '#F28C1E',
  white: '#FFFFFF',
} as const;

export const radius = { card: 22, sheet: 32, pill: 999, input: 16 } as const;
export const spacing = { screen: 20, gap: 12 } as const;
export const minTouch = 44;
export const fontFamily = { regular: 'NotoSansGeorgian_400Regular', semibold: 'NotoSansGeorgian_600SemiBold', extrabold: 'NotoSansGeorgian_800ExtraBold' } as const;

/** Dark app theme (customer app screens). Splash and login keep the yellow brand look. Our own choice, not official brand rules. */
export const theme = {
  bg: '#140B0A',
  surface: '#211614',
  surface2: '#2C1E1B',
  border: '#3A2A25',
  text: '#FFF4E0',
  muted: '#B8A69B',
} as const;
