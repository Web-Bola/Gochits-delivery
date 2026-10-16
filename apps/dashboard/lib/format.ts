export const gel = (tetri: number | null | undefined) => (tetri == null ? '—' : `₾${(tetri / 100).toFixed(2)}`);
/** "12.5" -> 1250 tetri; empty -> null; invalid -> NaN */
export function toTetri(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}
export const fromTetri = (t: number | null | undefined) => (t == null ? '' : (t / 100).toString());
export const WEEK = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი'];
export const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tbilisi' });
export function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tbilisi' }); }
