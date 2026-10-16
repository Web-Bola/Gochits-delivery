import { useCallback } from 'react';
import { addLine, type CartLine } from '@gochits/shared';
import { loadMenu } from './menuData';
import { supabase } from './supabase';
import { useCart } from '../state/cart';

export interface ReorderResult { added: number; skipped: string[] }

/** Puts the items of a past order back into the cart at CURRENT prices. Items that are gone or sold out are reported, never silently dropped. */
export function useReorder() {
  const { setBranch, setLines, branch, lines: current } = useCart();
  return useCallback(async (orderId: string): Promise<ReorderResult> => {
    const { data, error } = await supabase.from('orders')
      .select('branch_id, branches(name), order_items(product_id, name_snapshot, quantity, note)').eq('id', orderId).single();
    if (error || !data) throw error ?? new Error('order_not_found');
    const o = data as unknown as { branch_id: string; branches: { name: string } | null; order_items: { product_id: string; name_snapshot: string; quantity: number; note: string | null }[] };
    const menu = await loadMenu(o.branch_id);
    setBranch({ id: o.branch_id, name: o.branches?.name ?? '' });
    let lines: CartLine[] = branch?.id === o.branch_id ? [...current] : [];
    const skipped: string[] = [];
    for (const it of o.order_items) {
      const p = menu.products.find((x) => x.id === it.product_id);
      if (!p || !p.available) { skipped.push(it.name_snapshot); continue; }
      lines = addLine(lines, { productId: p.id, name: p.name, unitPriceTetri: p.price_tetri, note: it.note ?? undefined }, it.quantity);
    }
    setLines(lines);
    return { added: lines.reduce((n, l) => n + l.quantity, 0), skipped };
  }, [setBranch, setLines, branch, current]);
}
