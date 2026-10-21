'use client';
import { useEffect, useState } from 'react';
import { ok, supabase } from '@/lib/supabase';
import { Field, useAction, useLoad } from '@/components/bits';

interface Merchant { id: string | null; slug: string; name: string; kind: string; description: string | null; logo_path: string | null; cover_path: string | null; is_active: boolean; sort_order: number; branch_count?: number }
const KINDS: [string, string][] = [['restaurant', 'რესტორანი'], ['cafe', 'კაფე'], ['grocery', 'სუპერმარკეტი / მარკეტი'], ['pharmacy', 'აფთიაქი'], ['flowers', 'ყვავილები'], ['other', 'სხვა']];
const EMPTY: Merchant = { id: null, slug: '', name: '', kind: 'restaurant', description: '', logo_path: '', cover_path: '', is_active: true, sort_order: 0 };

function MerchantForm({ merchant, onSaved }: { merchant: Merchant; onSaved: () => void }) {
  const [m, setM] = useState(merchant);
  const { busy, run, note } = useAction();
  useEffect(() => setM(merchant), [merchant]);
  const set = <K extends keyof Merchant>(k: K, v: Merchant[K]) => setM((x) => ({ ...x, [k]: v }));
  const save = () => run(async () => {
    if (!m.name.trim()) throw new Error('სახელი აუცილებელია');
    if (!/^[a-z0-9][a-z0-9-]{1,40}$/.test(m.slug.trim().toLowerCase())) throw new Error('მისამართის სახელი (slug): ლათინური პატარა ასოები, ციფრები და „-“, მაგ. kafe-pirveli');
    ok(await supabase.rpc('admin_save_merchant', { p_id: m.id, p_slug: m.slug, p_name: m.name, p_kind: m.kind, p_description: m.description ?? '', p_logo_path: m.logo_path ?? '', p_cover_path: m.cover_path ?? '', p_is_active: m.is_active, p_sort_order: Math.round(Number(m.sort_order) || 0) }));
    onSaved();
  });
  return (
    <div className="card stack">
      <h2>{m.id ? m.name : 'ახალი ბიზნესი'}{m.id ? <span className="small muted"> · ფილიალები: {m.branch_count ?? 0}</span> : null}</h2>
      <div className="grid2">
        <Field label="სახელი"><input value={m.name} onChange={(e) => set('name', e.target.value)} placeholder="Kafe Pirveli" /></Field>
        <Field label="მისამართის სახელი (slug)"><input value={m.slug} onChange={(e) => set('slug', e.target.value)} placeholder="kafe-pirveli" /></Field>
        <Field label="ტიპი"><select value={m.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="რიგი სიაში"><input type="number" value={m.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} /></Field>
        <Field label="მოკლე აღწერა"><input value={m.description ?? ''} onChange={(e) => set('description', e.target.value)} placeholder="ყავა და ნამცხვრები" /></Field>
        <Field label="ლოგოს ფაილი (შემდეგ ეტაპზე)"><input value={m.logo_path ?? ''} onChange={(e) => set('logo_path', e.target.value)} placeholder="არასავალდებულო" /></Field>
      </div>
      <label className="chk"><input type="checkbox" checked={m.is_active} onChange={(e) => set('is_active', e.target.checked)} />აქტიურია (ჩანს აპში)</label>
      {note}
      <div><button disabled={busy} onClick={save}>{busy ? '…' : 'შენახვა'}</button></div>
    </div>
  );
}

export default function Merchants() {
  const { data, error, reload } = useLoad(async () => supabase.rpc('admin_merchants').then(ok<Merchant[]>));
  const [adding, setAdding] = useState(false);
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><h1>ბიზნესები</h1><p className="muted">პლატფორმაზე მიერთებული კომპანიები. თითოეულს აქვს საკუთარი ფილიალები და მენიუ.</p></div>
        <button onClick={() => setAdding(true)} disabled={adding}>+ ახალი ბიზნესი</button>
      </div>
      {error ? <div className="err">{error}</div> : null}
      {adding ? <MerchantForm merchant={EMPTY} onSaved={() => { setAdding(false); reload(); }} /> : null}
      {data?.map((m) => <MerchantForm key={m.id} merchant={m} onSaved={reload} />)}
      <p className="small muted">შემდეგი ნაბიჯი ახალი ბიზნესისთვის: „ფილიალები“ → ახალი ფილიალი (აირჩიე ეს ბიზნესი), შემდეგ „პროდუქტები“ → ამ ბიზნესის კატეგორიები და პროდუქტები.</p>
    </div>
  );
}
