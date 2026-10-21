import type { ReactNode } from 'react';
import { Image, Text, View } from 'react-native';
import { fontFamily, theme } from '@gochits/ui-tokens';
import { BackButton, Backdrop } from './ui';
import { Float } from './fx';
import { art } from '../lib/art';

/** Shared frame of the phone and SMS code screens: backdrop (food photo when provided), ZYRO logo, title, subtitle, content, keypad at the bottom. */
export function AuthShell({ title, subtitle, back, children, bottom, photo }: { title: string; subtitle?: ReactNode; back?: boolean; children: ReactNode; bottom: ReactNode; photo?: 'login' | 'otp' }) {
  return (
    <Backdrop source={photo ? art[photo] ?? undefined : undefined} fade={0.7}>
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 }}>
        <View style={{ height: 44 }}>{back ? <BackButton /> : null}</View>
        <View style={{ alignItems: 'center', gap: 14, marginTop: back ? 0 : 36 }}>
          <Float amplitude={4} duration={2600}><Image source={require('../../assets/zyro-logo.png')} style={{ width: 170, height: 78 }} resizeMode="contain" accessibilityLabel="ZYRO" /></Float>
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text accessibilityRole="header" style={{ fontFamily: fontFamily.extrabold, fontSize: 26, lineHeight: 34, color: theme.text, textAlign: 'center' }}>{title}</Text>
            {subtitle ? <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, lineHeight: 21, color: theme.muted, textAlign: 'center', paddingHorizontal: 12 }}>{subtitle}</Text> : null}
          </View>
        </View>
        <View style={{ gap: 14, marginTop: 24 }}>{children}</View>
        <View style={{ flex: 1 }} />
        {bottom}
      </View>
    </Backdrop>
  );
}
