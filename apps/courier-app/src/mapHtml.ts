export interface Pt { lat: number; lng: number }

/** Embedded Google Maps (no API key): a real driving route A -> B, a single point, or the city overview. */
export function embedUrl(a: Pt | null, b: Pt | null): string {
  const base = 'https://maps.google.com/maps?output=embed&hl=ka';
  if (a && b) return `${base}&saddr=${a.lat},${a.lng}&daddr=${b.lat},${b.lng}&dirflg=d`;
  const p = b ?? a;
  if (p) return `${base}&q=${p.lat},${p.lng}&z=15`;
  return `${base}&q=41.7151,44.8271&z=12`;
}

/** Turn-by-turn route in the phone's Google Maps app. */
export const routeUrl = (a: Pt, b: Pt) => `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=driving`;
export const pointUrl = (p: Pt) => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
