import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { mapHtml, type Pt } from './mapHtml';

function RouteMapImpl({ a, b, labelA, labelB, height = 220 }: { a: Pt; b: Pt; labelA: string; labelB: string; height?: number }) {
  const source = useMemo(() => ({ html: mapHtml(a, b, labelA, labelB) }), [a.lat, a.lng, b.lat, b.lng, labelA, labelB]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}>
      <WebView originWhitelist={['*']} source={source} scrollEnabled={false} javaScriptEnabled style={{ backgroundColor: '#2C1E1B' }} />
    </View>
  );
}

export const RouteMap = memo(RouteMapImpl);
