import { supabase } from './supabase';

export interface Category { id: string; name_ka: string; sort_order: number }
export interface Product {
  id: string; name: string; description_ka: string | null; price_tetri: number; old_price_tetri: number | null;
  image_path: string | null; category_id: string; sort_order: number; available: boolean; price_source: string;
}

export interface Menu { categories: Category[]; products: Product[] }

/** Menu of one branch: every active product, flagged `available` per branch (sold-out items stay visible). */
export async function loadMenu(branchId: string): Promise<Menu> {
  const [c, bp] = await Promise.all([
    supabase.from('categories').select('id,name_ka,sort_order').order('sort_order'),
    supabase.from('branch_products')
      .select('is_available, price_override_tetri, products(id,name,description_ka,price_tetri,old_price_tetri,image_path,category_id,sort_order,price_source,is_active)')
      .eq('branch_id', branchId),
  ]);
  if (c.error) throw c.error;
  if (bp.error) throw bp.error;
  type Row = { is_available: boolean; price_override_tetri: number | null; products: (Omit<Product, 'available'> & { is_active: boolean }) | null };
  const products = ((bp.data ?? []) as unknown as Row[])
    .filter((r) => r.products?.is_active)
    .map((r): Product => {
      const { is_active: _ignored, ...p } = r.products!;
      return { ...p, price_tetri: r.price_override_tetri ?? p.price_tetri, available: r.is_available };
    })
    .sort((a, b) => a.sort_order - b.sort_order);
  // categories belong to one business each: keep only the ones this branch actually offers
  const used = new Set(products.map((p) => p.category_id));
  return { categories: ((c.data ?? []) as Category[]).filter((x) => used.has(x.id)), products };
}

export function discountPercent(p: Pick<Product, 'price_tetri' | 'old_price_tetri'>): number | null {
  return p.old_price_tetri && p.old_price_tetri > p.price_tetri ? Math.round((1 - p.price_tetri / p.old_price_tetri) * 100) : null;
}

/** Categories offered as add-ons next to a main dish (sauces, sides, drinks). Matched by name; the owner can rename later without code. */
const EXTRA_WORDS = ['სოუს', 'გარნირ', 'სასმელ', 'მისაყოლებ'];
export const isExtraCategory = (c: Pick<Category, 'name_ka'>): boolean => EXTRA_WORDS.some((w) => c.name_ka.includes(w));

/** Ingredient names the customer may ask to leave out. Taken from the product description, minus the structural parts (meat, bun, patty layers). */
export function removableIngredients(description: string | null): string[] {
  if (!description) return [];
  return description.split(/[,;\n]/).map((x) => x.trim()).filter((x) => x.length > 1 && x.length < 40)
    .filter((x) => !/ხორც|ბულკ|ფენა|ბურგერ|პური|ფილე|ქათამი|სტეიკ/i.test(x)).slice(0, 6);
}

export const isSpicy = (p: Pick<Product, 'name' | 'description_ka'>): boolean => /ცხარე|ჯალაპენ|ჩილი|სრირაჩა|ტაბასკ/i.test(`${p.name} ${p.description_ka ?? ''}`);

/** Note stored on the order line: removed ingredients + free comment. */
export function buildNote(removed: string[], comment: string, prefix: string): string | undefined {
  const parts = [...removed.map((r) => `${prefix}: ${r}`), comment.trim()].filter(Boolean);
  return parts.length ? parts.join(' · ').slice(0, 300) : undefined;
}
