import type { ReactNode } from 'react';
import { Image, Text, View } from 'react-native';
import { fontFamily, theme } from '@gochits/ui-tokens';
import { BackButton } from './ui';
import { Float } from './fx';

/** Shared frame of the phone and SMS code screens: back arrow, ZYRO logo, title, subtitle, content, keypad at the bottom. */
export function AuthShell({ title, subtitle, back, children, bottom }: { title: string; subtitle?: string; back?: boolean; children: ReactNode; bottom: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 18 }}>
      <View style={{ height: 40 }}>{back ? <BackButton /> : null}</View>
      <View style={{ alignItems: 'center', gap: 16, marginTop: 4 }}>
        <Float amplitude={4} duration={2600}><Image source={require('../../assets/zyro-logo.png')} style={{ width: 150, height: 69 }} resizeMode="contain" accessibilityLabel="ZYRO" /></Float>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 24, lineHeight: 32, color: theme.text, textAlign: 'center' }}>{title}</Text>
          {subtitle ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 20, color: theme.muted, textAlign: 'center' }}>{subtitle}</Text> : null}
        </View>
      </View>
      <View style={{ gap: 14, marginTop: 22 }}>{children}</View>
      <View style={{ flex: 1 }} />
      {bottom}
    </View>
  );
}
