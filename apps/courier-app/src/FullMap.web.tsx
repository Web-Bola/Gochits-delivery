import { createElement, memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { mapHtml, type MapPt } from './mapHtml';

function Impl({ points }: { points: MapPt[] }) {
  const key = JSON.stringify(points);
  const html = useMemo(() => mapHtml(points), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <View style={StyleSheet.absoluteFill}>{createElement('iframe', { srcDoc: html, style: { width: '100%', height: '100%', border: 0 }, title: 'რუკა' })}</View>;
}
export const FullMap = memo(Impl);
