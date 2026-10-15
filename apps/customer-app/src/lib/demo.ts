import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** True only when the server flag app_settings.demo_mode is 'true'. Never decided by the client. */
export function useDemoMode(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.rpc('is_demo_mode').then(({ data, error }) => alive && setOn(error ? false : data === true));
    return () => { alive = false; };
  }, []);
  return on;
}

