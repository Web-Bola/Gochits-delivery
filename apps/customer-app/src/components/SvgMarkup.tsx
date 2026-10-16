import { createElement, type ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

const TAGS = { g: G, path: Path, rect: Rect, circle: Circle, ellipse: Ellipse } as const;
type Tag = keyof typeof TAGS;

/** Tiny SVG-markup renderer: g, path, rect, circle, ellipse with plain attributes. Enough for the illustrated tracking scenes. */
function build(markup: string): ReactNode[] {
  const root: { tag: Tag | 'root'; props: Record<string, string>; kids: ReactNode[] } = { tag: 'root', props: {}, kids: [] };
  const stack = [root];
  let key = 0;
  for (const m of markup.matchAll(/<(\/?)(g|path|rect|circle|ellipse)\b([^>]*?)(\/?)>/g)) {
    const closing = m[1] === '/'; const tag = m[2] as Tag; const self = m[4] === '/';
    const top = stack[stack.length - 1]!;
    if (closing) {
      const done = stack.pop()!;
      stack[stack.length - 1]!.kids.push(createElement(TAGS[done.tag as Tag] as never, { key: key++, ...done.props }, ...done.kids));
      continue;
    }
    const props: Record<string, string> = {};
    for (const a of (m[3] ?? '').matchAll(/([\w-]+)="([^"]*)"/g)) props[(a[1] ?? '').replace(/-(\w)/g, (_, c: string) => c.toUpperCase())] = a[2] ?? '';
    if (self || tag !== 'g') top.kids.push(createElement(TAGS[tag] as never, { key: key++, ...props }));
    else stack.push({ tag, props, kids: [] });
  }
  return root.kids;
}

export function SvgMarkup({ markup, viewBox, width, height, slice }: { markup: string; viewBox: string; width: number | string; height: number | string; slice?: boolean }) {
  return <Svg width={width as number} height={height as number} viewBox={viewBox} preserveAspectRatio={slice ? 'xMidYMid slice' : 'xMidYMid meet'}>{build(markup)}</Svg>;
}
