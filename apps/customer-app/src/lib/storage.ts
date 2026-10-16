import AsyncStorage from '@react-native-async-storage/async-storage';

/** Small JSON helpers. Storage can fail (private mode, full disk): the app must work without it. */
export async function loadJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  try {
    if (value === null || value === undefined) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch { /* ignore */ }
}
