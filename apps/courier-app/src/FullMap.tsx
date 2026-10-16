import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { mapHtml, type MapPt } from './mapHtml';

function Impl({ points }: { points: MapPt[] }) {
  const key = JSON.stringify(points);
  const source = useMemo(() => ({ html: mapHtml(points) }), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <View style={StyleSheet.absoluteFill}><WebView originWhitelist={['*']} source={source} javaScriptEnabled style={{ backgroundColor: '#EFE9DA' }} /></View>;
}
export const FullMap = memo(Impl);
