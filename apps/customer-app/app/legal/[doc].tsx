import { Linking, ScrollView, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ka } from '@gochits/i18n';
import { fontFamily, theme } from '@gochits/ui-tokens';
import { Body, Button, Header, Screen } from '../../src/components/ui';

// The legal texts are written by the lawyer, not by us. Until they exist this screen says so.
// When the texts are published on a web page, set EXPO_PUBLIC_TERMS_URL / EXPO_PUBLIC_PRIVACY_URL and the screen links to them.
const URLS: Record<string, string | undefined> = { terms: process.env.EXPO_PUBLIC_TERMS_URL, privacy: process.env.EXPO_PUBLIC_PRIVACY_URL };

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const title = doc === 'privacy' ? ka.profile.legalPrivacy : ka.profile.legalTerms;
  const url = URLS[String(doc)];
  return (
    <Screen scroll>
      <Header back title={title} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        {url ? <Button title={title} onPress={() => Linking.openURL(url).catch(() => undefined)} variant="ink" /> : null}
        <Text style={{ fontFamily: fontFamily.regular, fontSize: 14, color: theme.text, lineHeight: 22 }}>{ka.profile.termsTxt}</Text>
        <Body muted>{' '}</Body>
      </ScrollView>
    </Screen>
  );
}
