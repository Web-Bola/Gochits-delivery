import { createElement } from 'react';
import { Platform } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Line icons (24x24 grid) from the approved demo. Markup is kept as compact strings and turned into svg elements on first use. */
const PATHS: Record<string, string> = {
  cburger: '<path d="M4 11a8 6 0 0 1 16 0z"/><path d="M3 14h18"/><path d="M5 17h14a2 2 0 0 1-2 3H7a2 2 0 0 1-2-3z"/>',
  cfries: '<path d="M6 10h12l-1.5 11h-9z"/><path d="M8 10V4M12 10V3M16 10V5"/>',
  ccup: '<path d="M6 7h12l-1.5 14h-9z"/><path d="M12 7l1-5"/><path d="M7 12h10"/>',
  cdrop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  cwrap: '<path d="M4 14 14 4l6 6L10 20z"/><path d="M8 10l6 6"/>',
  cbowl: '<path d="M3 12h18a9 9 0 0 1-18 0z"/><path d="M8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4"/>',
  ccombo: '<rect x="4" y="9" width="16" height="12" rx="2"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-4 3 0-3-1-5-3-8-1 3-4 6-4 11 0 4 3 8 7 8z"/>',
  bike: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M6 17h5l3-8h3M10 9h4"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  star: '<path d="M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.1 1.1-6.5L2.6 9.4l6.5-.9z"/>',
  wallet: '<path d="M3 7a2 2 0 0 1 2-2h13v4"/><path d="M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2z"/><circle cx="16" cy="14.5" r="1"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  receipt: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  store: '<path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v8h14v-8"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
};

export type IconName = keyof typeof PATHS | (string & {});

const cache: Record<string, { tag: 'path' | 'circle' | 'rect'; props: Record<string, string> }[]> = {};
function parse(name: string) {
  if (cache[name]) return cache[name];
  const out: { tag: 'path' | 'circle' | 'rect'; props: Record<string, string> }[] = [];
  for (const m of (PATHS[name] ?? '').matchAll(/<(path|circle|rect)\s+([^>]*?)\/?>/g)) {
    const props: Record<string, string> = {};
    for (const a of (m[2] ?? '').matchAll(/([\w-]+)="([^"]*)"/g)) props[a[1] ?? ''] = a[2] ?? '';
    out.push({ tag: m[1] as 'path' | 'circle' | 'rect', props });
  }
  return (cache[name] = out);
}

const TAG = { path: Path, circle: Circle, rect: Rect } as const;

export function Icon({ name, size = 22, color = '#1B2420', fill, strokeWidth = 2 }: { name: IconName; size?: number; color?: string; fill?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill ?? 'none'} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...(Platform.OS === 'web' ? {} : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const })}>
      {parse(name).map((e, i) => createElement(TAG[e.tag] as never, { key: i, ...camel(e.props) }))}
    </Svg>
  );
}

function camel(p: Record<string, string>) {
  const o: Record<string, string> = {};
  for (const k of Object.keys(p)) o[k.replace(/-(\w)/g, (_, c: string) => c.toUpperCase())] = p[k] ?? '';
  return o;
}

/** Category icon by name (matched like the demo: combo, burger, wrap, bowl, sauce, sides, drinks). */
export function categoryIcon(name: string): string {
  return /კომბო/.test(name) ? 'ccombo' : /ბურგერ/.test(name) ? 'cburger' : /ვრეპ|როლ/.test(name) ? 'cwrap' : /ბოულ/.test(name) ? 'cbowl' : /სოუს/.test(name) ? 'cdrop' : /გარნირ/.test(name) ? 'cfries' : /სასმ/.test(name) ? 'ccup' : 'cburger';
}
