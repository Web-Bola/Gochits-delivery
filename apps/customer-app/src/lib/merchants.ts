import { supabase } from './supabase';

export interface Merchant {
  id: string; slug: string; name: string; kind: string; description: string | null; logo_path: string | null; cover_path: string | null;
  branch_count: number; any_open: boolean; any_accepting: boolean; pickup_available: boolean;
}

export const KIND_LABEL: Record<string, string> = { restaurant: 'რესტორნები', cafe: 'კაფეები', grocery: 'მარკეტები', pharmacy: 'აფთიაქები', flowers: 'ყვავილები', other: 'სხვა' };
export const KIND_ONE: Record<string, string> = { restaurant: 'რესტორანი', cafe: 'კაფე', grocery: 'მარკეტი', pharmacy: 'აფთიაქი', flowers: 'ყვავილების მაღაზია', other: 'ბიზნესი' };
export const KIND_ICON: Record<string, string> = { restaurant: 'cburger', cafe: 'ccup', grocery: 'bag', pharmacy: 'cross', flowers: 'heart', other: 'store' };

export async function loadMerchants(): Promise<Merchant[]> {
  const { data, error } = await supabase.rpc('list_merchants');
  if (error) throw error;
  return (data ?? []) as Merchant[];
}

/** Bundled artwork exists only for the first business; the others get a clean initial-letter badge until they upload a logo. */
export const hasBundledArt = (m: Pick<Merchant, 'slug'>): boolean => m.slug === 'gochits';
export const initial = (name: string): string => (name.trim()[0] ?? '?').toUpperCase();
