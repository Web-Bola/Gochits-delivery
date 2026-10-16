import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

let handlerSet = false;

/** Stores the device token for the signed-in user. Asks for permission only when `ask` is true (we ask right after the first order, when it makes sense to the customer).
 *  Native real devices only, and only with an EAS projectId; everywhere else this does nothing. expo-notifications is loaded lazily so web/test builds never touch it. */
export async function registerForPush(ask = false): Promise<void> {
  if (Platform.OS === 'web' || !Device.isDevice) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return;
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const Notifications = await import('expo-notifications');
  if (!handlerSet) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
    });
    handlerSet = true;
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask) ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('orders', { name: 'შეკვეთები', importance: Notifications.AndroidImportance.HIGH });
  }
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await supabase.from('push_tokens').upsert({ token, user_id: u.user.id, platform: Platform.OS === 'ios' ? 'ios' : 'android', updated_at: new Date().toISOString() });
}

/** Registers on every launch/sign-in when permission is already granted. Failures are silent: notifications are a convenience, never a blocker. */
export function usePushRegistration(): void {
  useEffect(() => {
    registerForPush().catch(() => undefined);
    const { data: sub } = supabase.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN') registerForPush().catch(() => undefined); });
    return () => sub.subscription.unsubscribe();
  }, []);
}
