/** All money is integer tetri (1 GEL = 100 tetri). The server computes totals; the UI only displays them. */
export function formatGel(tetri: number): string {
  if (!Number.isInteger(tetri)) throw new Error('tetri must be an integer');
  const sign = tetri < 0 ? '-' : '';
  const abs = Math.abs(tetri);
  return `${sign}₾ ${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export const PRICE_PLACEHOLDER = '₾ --.--';
