import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
/** Each panel keeps its own login, so admin and restaurant staff can be open in the same browser at once. */
const area = typeof window !== 'undefined' && (window.location.pathname.includes('/restaurant') || new URLSearchParams(window.location.search).get('next') === '/restaurant') ? 'restaurant' : 'admin';
export const configured = /^https?:\/\//.test(url) && key.length > 10;
export const supabase = createClient(configured ? url : 'http://localhost:54321', configured ? key : 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: `gochits.${area}.session` },
});

/** Throws a readable error when a Supabase call fails. */
export function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
