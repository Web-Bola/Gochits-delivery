import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/** false only when the OS says there is no connection at all. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    // only a definite "no connection" counts; the reachability probe (isInternetReachable) can be blocked by networks that are fine
    const unsub = NetInfo.addEventListener((s) => setOnline(s.isConnected !== false));
    return () => unsub();
  }, []);
  return online;
}

/** supabase-js reports network failures as errors with these messages. */
export const isNetworkError = (e: unknown): boolean => {
  const m = e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  return /network|fetch|failed to fetch|timeout|offline/i.test(m);
};
