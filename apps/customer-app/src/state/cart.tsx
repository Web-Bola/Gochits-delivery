import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { addLine, cartSubtotal, removeLine, type BranchOption, type CartLine } from '@gochits/shared';

export interface DeliveryAddress { id: string; street: string; lat: number; lng: number }

interface Ctx {
  lines: CartLine[];
  add: (l: Omit<CartLine, 'quantity'>) => void;
  remove: (productId: string) => void;
  clear: () => void;
  subtotal: number;
  count: number;
  address: DeliveryAddress | null;
  setAddress: (a: DeliveryAddress | null) => void;
  branch: BranchOption | null;
  setBranch: (b: BranchOption | null) => void;
}

const C = createContext<Ctx | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [address, setAddress] = useState<DeliveryAddress | null>(null);
  const [branch, setBranch] = useState<BranchOption | null>(null);
  const value = useMemo<Ctx>(() => ({
    lines,
    add: (l) => setLines((p) => addLine(p, l)),
    remove: (id) => setLines((p) => removeLine(p, id)),
    clear: () => setLines([]),
    subtotal: cartSubtotal(lines),
    count: lines.reduce((n, l) => n + l.quantity, 0),
    address, setAddress, branch, setBranch,
  }), [lines, address, branch]);
  return <C.Provider value={value}>{children}</C.Provider>;
}

export function useCart(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error('CartProvider missing');
  return v;
}
