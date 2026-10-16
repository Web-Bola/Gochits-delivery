import { createElement, memo, useMemo } from 'react';
import { View } from 'react-native';
import { mapHtml, type Pt } from './mapHtml';

function RouteMapImpl({ a, b, labelA, labelB, height = 220 }: { a: Pt; b: Pt; labelA: string; labelB: string; height?: number }) {
  const html = useMemo(() => mapHtml(a, b, labelA, labelB), [a.lat, a.lng, b.lat, b.lng, labelA, labelB]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      {createElement('iframe', { srcDoc: html, style: { width: '100%', height: '100%', border: 0 }, title: 'რუკა' })}
    </View>
  );
}

export const RouteMap = memo(RouteMapImpl);
