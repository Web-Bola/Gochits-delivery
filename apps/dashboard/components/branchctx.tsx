'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ok, supabase } from '@/lib/supabase';

export interface MyBranch { id: string; name: string; accepts_orders: boolean; pickup_enabled: boolean }
interface Ctx { branches: MyBranch[]; branch: MyBranch | null; setBranchId: (id: string) => void; reload: () => Promise<void> }
const C = createContext<Ctx>({ branches: [], branch: null, setBranchId: () => undefined, reload: async () => undefined });
export const useBranch = () => useContext(C);

/** Loads the branches this staff account may work in and remembers the chosen one. */
export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<MyBranch[] | null>(null);
  const [id, setId] = useState('');
  const [err, setErr] = useState('');
  const reload = async () => {
    try { setBranches(ok(await supabase.rpc('staff_my_branches') as { data: MyBranch[] | null; error: { message: string } | null })); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { reload(); try { setId(localStorage.getItem('gochits.branch') ?? ''); } catch { /* ignore */ } }, []);
  if (err) return <div className="err">{err}</div>;
  if (!branches) return <p className="muted">იტვირთება…</p>;
  if (branches.length === 0) return <div className="err">ამ ანგარიშზე ფილიალი მიბმული არ არის. სთხოვე ადმინს: ადმინ პანელი → თანამშრომლები.</div>;
  const branch = branches.find((b) => b.id === id) ?? branches[0] ?? null;
  return <C.Provider value={{ branches, branch, setBranchId: (v) => { setId(v); try { localStorage.setItem('gochits.branch', v); } catch { /* ignore */ } }, reload }}>{children}</C.Provider>;
}
