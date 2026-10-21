import { supabase } from './supabase';

export type Gate = 'home' | 'pending' | 'register' | 'suspended' | 'login';

/** Where should this signed-in person land? Falls back to the old role check if the 0016 migration is not applied yet. */
export async function gateFor(): Promise<Gate> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return 'login';
  const r = await supabase.rpc('courier_my_status');
  if (!r.error) {
    const row = (r.data as { status: string }[] | null)?.[0];
    if (!row) {
      const { data: p } = await supabase.from('profiles').select('role').eq('id', s.session.user.id).maybeSingle();
      return p?.role === 'courier' || p?.role === 'super_admin' ? 'home' : 'register';
    }
    return row.status === 'approved' ? 'home' : row.status === 'suspended' ? 'suspended' : 'pending';
  }
  const { data: p } = await supabase.from('profiles').select('role').eq('id', s.session.user.id).maybeSingle();
  return p?.role === 'courier' || p?.role === 'super_admin' ? 'home' : 'register';
}

export const PATH: Record<Gate, '/' | '/pending' | '/register' | '/login'> = { home: '/', pending: '/pending', suspended: '/pending', register: '/register', login: '/login' };
