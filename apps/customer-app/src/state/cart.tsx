import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { addLine, cartSubtotal, removeLine, type CartLine, type NewLine } from '@gochits/shared';
import { errorText } from '@gochits/i18n';
import { loadJson, saveJson } from '../lib/storage';
import { supabase } from '../lib/supabase';

export interface PickedBranch { id: string; name: string }
export interface DeliveryAddress { id: string; street: string; lat: number; lng: number; entrance?: string | null; floor?: string | null; apartment?: string | null }
export interface AppliedPromo { code: string; discountTetri: number }

interface Ctx {
  ready: boolean;
  lines: CartLine[];
  add: (l: NewLine, qty?: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  setLines: (l: CartLine[]) => void;
  subtotal: number;
  count: number;
  branch: PickedBranch | null;
  /** Switching to another branch empties the cart: availability and prices differ per branch. */
  setBranch: (b: PickedBranch | null) => void;
  address: DeliveryAddress | null;
  setAddress: (a: DeliveryAddress | null) => void;
  promo: AppliedPromo | null;
  setPromo: (p: AppliedPromo | null) => void;
  resetAll: () => void;
}

const C = createContext<Ctx | null>(null);
const KEY = 'gochits.session.v1';
interface Saved { lines: CartLine[]; branch: PickedBranch | null; address: DeliveryAddress | null }

export function CartProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [lines, setLinesState] = useState<CartLine[]>([]);
  const [branch, setBranchState] = useState<PickedBranch | null>(null);
  const [address, setAddress] = useState<DeliveryAddress | null>(null);
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const branchRef = useRef<PickedBranch | null>(null);

  useEffect(() => {
    loadJson<Saved>(KEY).then((s) => {
      if (s) {
        // validate shape: never trust stale or hand-edited storage
        if (Array.isArray(s.lines)) setLinesState(s.lines.filter((l) => l && typeof l.key === 'string' && typeof l.productId === 'string' && Number.isInteger(l.quantity) && l.quantity > 0 && Number.isInteger(l.unitPriceTetri)));
        if (s.branch?.id) { setBranchState(s.branch); branchRef.current = s.branch; }
        if (s.address?.id) setAddress(s.address);
      }
      setReady(true);
    });
  }, []);
  useEffect(() => { if (ready) saveJson(KEY, { lines, branch, address } satisfies Saved); }, [ready, lines, branch, address]);

  const setBranch = useCallback((b: PickedBranch | null) => {
    if (branchRef.current?.id !== b?.id) { setLinesState([]); setPromo(null); }
    branchRef.current = b;
    setBranchState(b);
  }, []);

  const value = useMemo<Ctx>(() => ({
    ready, lines,
    add: (l, qty = 1) => { setLinesState((p) => addLine(p, l, qty)); },
    remove: (key) => { setLinesState((p) => removeLine(p, key)); },
    clear: () => { setLinesState([]); setPromo(null); },
    setLines: (l) => { setLinesState(l); },
    subtotal: cartSubtotal(lines),
    count: lines.reduce((n, l) => n + l.quantity, 0),
    branch, setBranch, address, setAddress, promo, setPromo,
    resetAll: () => { setLinesState([]); setPromo(null); setAddress(null); branchRef.current = null; setBranchState(null); },
  }), [ready, lines, branch, address, promo, setBranch]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useCart(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('CartProvider missing');
  return v;
}

/** Keeps an applied promo honest when the cart changes: the server re-prices it, or drops it with a reason. Returns that reason. */
export function usePromoSync(): string | null {
  const { promo, setPromo, subtotal } = useCart();
  const [msg, setMsg] = useState<string | null>(null);
  const code = promo?.code;
  const known = promo?.discountTetri;
  useEffect(() => {
    if (!code) return;
    if (subtotal <= 0) { setPromo(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('apply_promo', { p_code: code, p_subtotal: subtotal });
      if (!alive) return;
      if (error) { setPromo(null); setMsg(errorText(error.message)); return; }
      setMsg(null);
      if (typeof data === 'number' && data !== known) setPromo({ code, discountTetri: data });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [code, subtotal, known, setPromo]);
  return msg;
}
