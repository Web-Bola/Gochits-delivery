import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

function Impl({ url }: { url: string }) {
  return <View style={StyleSheet.absoluteFill}><WebView originWhitelist={['*']} source={{ uri: url }} javaScriptEnabled style={{ backgroundColor: '#EFE9DA' }} /></View>;
}
export const FullMap = memo(Impl);
