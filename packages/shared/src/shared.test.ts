import { describe, expect, it } from 'vitest';
import { addLine, cartSubtotal, removeLine, productQuantity, toOrderItems, canStaffTransition, formatGel, nearestOrderable, sortBranchOptions, type BranchOption } from './index';

const opt = (o: Partial<BranchOption>): BranchOption => ({
  branch_id: 'b', branch_name: 'B', zone_id: 'z', zone_name: 'Z', fee_tetri: 300,
  min_order_tetri: 0, free_from_tetri: null, extra_minutes: 0, distance_m: 1000, can_order: true, cod_enabled: false, is_open: true, ...o,
});

describe('money', () => {
  it('formats tetri', () => {
    expect(formatGel(1746)).toBe('₾ 17.46');
    expect(formatGel(5)).toBe('₾ 0.05');
    expect(formatGel(0)).toBe('₾ 0.00');
  });
  it('rejects non-integers', () => expect(() => formatGel(1.5)).toThrow());
});

describe('cart', () => {
  it('adds, increments, removes', () => {
    let c = addLine([], { productId: 'a', name: 'A', unitPriceTetri: 1000 });
    c = addLine(c, { productId: 'a', name: 'A', unitPriceTetri: 1000 });
    expect(cartSubtotal(c)).toBe(2000);
    c = removeLine(c, 'a');
    expect(c[0]?.quantity).toBe(1);
    expect(removeLine(c, 'a')).toEqual([]);
  });
  it('caps quantity at 50', () => {
    let c = addLine([], { productId: 'a', name: 'A', unitPriceTetri: 1 });
    for (let i = 0; i < 80; i++) c = addLine(c, { productId: 'a', name: 'A', unitPriceTetri: 1 });
    expect(c[0]?.quantity).toBe(50);
  });
});

describe('cart notes', () => {
  it('keeps different notes on separate lines, same note merges', () => {
    let c = addLine([], { productId: 'a', name: 'A', unitPriceTetri: 1000 });
    c = addLine(c, { productId: 'a', name: 'A', unitPriceTetri: 1000, note: 'ამოღებულია: ხახვი' });
    c = addLine(c, { productId: 'a', name: 'A', unitPriceTetri: 1000, note: '  ამოღებულია: ხახვი ' });
    expect(c).toHaveLength(2);
    expect(c[1]?.quantity).toBe(2);
    expect(productQuantity(c, 'a')).toBe(3);
    expect(cartSubtotal(c)).toBe(3000);
  });
  it('removes by key, not by product', () => {
    let c = addLine([], { productId: 'a', name: 'A', unitPriceTetri: 1 });
    c = addLine(c, { productId: 'a', name: 'A', unitPriceTetri: 1, note: 'x' });
    c = removeLine(c, c[1]!.key);
    expect(c.map((l) => l.note)).toEqual([undefined]);
  });
  it('adds several at once and caps at 50', () => {
    expect(addLine([], { productId: 'a', name: 'A', unitPriceTetri: 1 }, 3)[0]?.quantity).toBe(3);
    expect(addLine([], { productId: 'a', name: 'A', unitPriceTetri: 1 }, 99)[0]?.quantity).toBe(50);
  });
  it('order payload carries no prices', () => {
    const c = addLine([], { productId: 'a', name: 'A', unitPriceTetri: 999, note: 'n' }, 2);
    expect(toOrderItems(c)).toEqual([{ product_id: 'a', quantity: 2, note: 'n' }]);
  });
});

describe('order status', () => {
  it('allows the happy path', () => {
    expect(canStaffTransition('placed', 'accepted')).toBe(true);
    expect(canStaffTransition('out_for_delivery', 'delivered')).toBe(true);
  });
  it('blocks skips and terminal moves', () => {
    expect(canStaffTransition('placed', 'delivered')).toBe(false);
    expect(canStaffTransition('delivered', 'preparing')).toBe(false);
  });
});

describe('branch options', () => {
  it('puts orderable first, then nearest', () => {
    const list = [opt({ branch_id: 'far', distance_m: 5000 }), opt({ branch_id: 'closed', distance_m: 100, can_order: false }), opt({ branch_id: 'near', distance_m: 800 })];
    expect(sortBranchOptions(list).map((o) => o.branch_id)).toEqual(['near', 'far', 'closed']);
    expect(nearestOrderable(list)?.branch_id).toBe('near');
  });
  it('returns undefined when nothing is orderable', () => expect(nearestOrderable([opt({ can_order: false })])).toBeUndefined());
});
