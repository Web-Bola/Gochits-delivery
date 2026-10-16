import { createElement, memo } from 'react';
import { StyleSheet, View } from 'react-native';

function Impl({ url }: { url: string }) {
  return <View style={StyleSheet.absoluteFill}>{createElement('iframe', { src: url, style: { width: '100%', height: '100%', border: 0 }, title: 'რუკა', loading: 'eager', allowFullScreen: true })}</View>;
}
export const FullMap = memo(Impl);
