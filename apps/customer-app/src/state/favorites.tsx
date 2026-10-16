import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

interface Ctx { ids: ReadonlySet<string>; toggle: (productId: string) => Promise<void>; reload: () => Promise<void> }
const C = createContext<Ctx | null>(null);

/** Favorites live in the database (table favorites, RLS: own rows only). Optimistic toggle, rolled back on error. */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<ReadonlySet<string>>(new Set());

  const reload = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { setIds(new Set()); return; }
    const { data, error } = await supabase.from('favorites').select('product_id');
    if (!error) setIds(new Set(((data ?? []) as { product_id: string }[]).map((r) => r.product_id)));
  }, []);

  useEffect(() => {
    reload();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { reload(); });
    return () => sub.subscription.unsubscribe();
  }, [reload]);

  const toggle = useCallback(async (productId: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const had = ids.has(productId);
    setIds((p) => { const n = new Set(p); if (had) n.delete(productId); else n.add(productId); return n; });
    const { error } = had
      ? await supabase.from('favorites').delete().eq('product_id', productId)
      : await supabase.from('favorites').insert({ user_id: u.user.id, product_id: productId });
    if (error) setIds((p) => { const n = new Set(p); if (had) n.add(productId); else n.delete(productId); return n; });
  }, [ids]);

  const value = useMemo(() => ({ ids, toggle, reload }), [ids, toggle, reload]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useFavorites(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('FavoritesProvider missing');
  return v;
}
