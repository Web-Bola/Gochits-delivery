import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Native: session tokens live in the OS secure store. Web (testing only): browser localStorage, since SecureStore does not exist there.
const nativeStorage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};
const webStorage = {
  getItem: async (k: string) => { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  setItem: async (k: string, v: string) => { try { globalThis.localStorage?.setItem(k, v); } catch { /* storage blocked */ } },
  removeItem: async (k: string) => { try { globalThis.localStorage?.removeItem(k); } catch { /* storage blocked */ } },
};

export const supabase = createClient(url, anonKey, {
  auth: { storageKey: 'gochits.courier.session', storage: Platform.OS === 'web' ? webStorage : nativeStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

export const isConfigured = url.length > 0 && anonKey.length > 0;
