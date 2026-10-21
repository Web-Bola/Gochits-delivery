'use client';
import { useState } from 'react';
import { ok, supabase } from '@/lib/supabase';
import { gel } from '@/lib/format';
import { useAction, useLoad } from '@/components/bits';
import { useBranch } from '@/components/branchctx';

interface Cat { id: string; name_ka: string; sort_order: number; merchant_id: string }
interface Prod { id: string; category_id: string; name: string; price_tetri: number; is_active: boolean }
interface BP { product_id: string; is_available: boolean }

export default function RestaurantMenu() {
  const { branch } = useBranch();
  const { data, error, reload } = useLoad(async () => {
    if (!branch) return null;
    const [cats, prods, bps, br] = await Promise.all([
      supabase.from('categories').select('id,name_ka,sort_order,merchant_id').order('sort_order').then(ok<Cat[]>),
      supabase.from('products').select('id,category_id,name,price_tetri,is_active').eq('is_active', true).order('sort_order').then(ok<Prod[]>),
      supabase.from('branch_products').select('product_id,is_available').eq('branch_id', branch.id).then(ok<BP[]>),
      supabase.from('branches').select('merchant_id').eq('id', branch.id).single().then(ok<{ merchant_id: string }>),
    ]);
    return { cats: cats.filter((c) => c.merchant_id === br.merchant_id), prods, bps };
  });
  const [q, setQ] = useState('');
  const { busy, run, note } = useAction();
  if (!branch) return null;
  const on = (pid: string) => data?.bps.find((b) => b.product_id === pid)?.is_available ?? false;
  const set = (pid: string, v: boolean) => run(async () => {
    const has = data?.bps.some((b) => b.product_id === pid);
    if (has) ok(await supabase.from('branch_products').update({ is_available: v }).eq('branch_id', branch.id).eq('product_id', pid).select('product_id'));
    else throw new Error('ეს პროდუქტი ამ ფილიალში ჯერ არ არის დამატებული. სთხოვე ადმინს.');
    await reload();
  }, v ? 'დაბრუნდა მენიუში ✓' : 'მონიშნულია „ამოიწურა“ ✓');

  return (
    <div className="stack">
      <div><h1>მენიუ და მარაგი</h1><p className="muted">{branch.name} · გამორთული პროდუქტი აპში გამოჩნდება „ამოიწურა“-ით და ვერ შეკვეთება</p></div>
      {error ? <div className="err">{error}</div> : null}
      {note}
      <input placeholder="ძებნა…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 320 }} />
      {data?.cats.map((c) => {
        const items = data.prods.filter((p) => p.category_id === c.id && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
        if (!items.length) return null;
        return (
          <div key={c.id} className="card stack">
            <h2>{c.name_ka}</h2>
            <div className="grid2">
              {items.map((p) => (
                <label key={p.id} className="chk" style={{ justifyContent: 'space-between', background: 'var(--surface2)', borderRadius: 12, padding: '10px 12px', opacity: on(p.id) ? 1 : 0.6 }}>
                  <span><b>{p.name}</b> <span className="muted small">{gel(p.price_tetri)}</span></span>
                  <span className="row" style={{ gap: 8 }}><span className={`pill ${on(p.id) ? 'ok' : 'bad'}`}>{on(p.id) ? 'არის' : 'ამოიწურა'}</span>
                    <input type="checkbox" disabled={busy} checked={on(p.id)} onChange={(e) => set(p.id, e.target.checked)} /></span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
