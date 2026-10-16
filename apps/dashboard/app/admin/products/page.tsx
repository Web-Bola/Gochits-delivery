'use client';
import { useState } from 'react';
import { ok, supabase } from '@/lib/supabase';
import { fromTetri, toTetri } from '@/lib/format';
import { Field, useAction, useLoad } from '@/components/bits';

interface Cat { id: string; name_ka: string; sort_order: number }
interface Prod { id: string; category_id: string; name: string; description_ka: string | null; price_tetri: number; old_price_tetri: number | null; price_source: string; is_active: boolean; sort_order: number }
interface Br { id: string; name: string }
interface BP { branch_id: string; product_id: string; is_available: boolean }

function ProductEdit({ p, cats, onSaved }: { p: Prod | null; cats: Cat[]; onSaved: () => void }) {
  const [name, setName] = useState(p?.name ?? '');
  const [cat, setCat] = useState(p?.category_id ?? cats[0]?.id ?? '');
  const [desc, setDesc] = useState(p?.description_ka ?? '');
  const [price, setPrice] = useState(fromTetri(p?.price_tetri));
  const [old, setOld] = useState(fromTetri(p?.old_price_tetri));
  const [active, setActive] = useState(p?.is_active ?? true);
  const [approved, setApproved] = useState((p?.price_source ?? 'unapproved') === 'approved');
  const [sort, setSort] = useState((p?.sort_order ?? 0).toString());
  const { busy, run, note } = useAction();

  const save = () => run(async () => {
    const pr = toTetri(price), od = toTetri(old);
    if (!name.trim()) throw new Error('სახელი აუცილებელია');
    if (pr === null || Number.isNaN(pr)) throw new Error('ფასი არასწორია');
    if (Number.isNaN(od)) throw new Error('ძველი ფასი არასწორია');
    if (od !== null && od <= pr) throw new Error('ძველი ფასი უნდა იყოს ახალზე მეტი (თუ ფასდაკლება არ არის, დატოვე ცარიელი)');
    const row = { name: name.trim(), category_id: cat, description_ka: desc.trim() || null, price_tetri: pr, old_price_tetri: od, is_active: active, price_source: approved ? 'approved' : 'unapproved', sort_order: Number(sort) || 0 };
    if (p) ok(await supabase.from('products').update(row).eq('id', p.id).select('id'));
    else ok(await supabase.from('products').insert(row).select('id'));
    onSaved();
  });

  return (
    <tr style={{ background: p ? undefined : 'var(--surface2)' }}>
      <td colSpan={9}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div style={{ width: 200 }}><Field label="სახელი"><input value={name} onChange={(e) => setName(e.target.value)} /></Field></div>
          <div style={{ width: 150 }}><Field label="კატეგორია"><select value={cat} onChange={(e) => setCat(e.target.value)}>{cats.map((c) => <option key={c.id} value={c.id}>{c.name_ka}</option>)}</select></Field></div>
          <div style={{ width: 220 }}><Field label="აღწერა"><input value={desc} onChange={(e) => setDesc(e.target.value)} /></Field></div>
          <div style={{ width: 90 }}><Field label="ფასი ₾"><input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" /></Field></div>
          <div style={{ width: 90 }}><Field label="ძველი ₾"><input value={old} onChange={(e) => setOld(e.target.value)} inputMode="decimal" /></Field></div>
          <div style={{ width: 64 }}><Field label="რიგი"><input value={sort} onChange={(e) => setSort(e.target.value)} inputMode="numeric" /></Field></div>
          <label className="chk"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />ჩანს</label>
          <label className="chk"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />ფასი დამტკიცებულია</label>
          <button disabled={busy} onClick={save}>{busy ? '…' : p ? 'შენახვა' : 'დამატება'}</button>
        </div>
        {note}
      </td>
    </tr>
  );
}

function Categories({ cats, onSaved }: { cats: Cat[]; onSaved: () => void }) {
  const [name, setName] = useState('');
  const { busy, run, note } = useAction();
  const upd = (c: Cat, patch: Partial<Cat>) => run(async () => { ok(await supabase.from('categories').update(patch).eq('id', c.id).select('id')); onSaved(); });
  return (
    <div className="card stack">
      <h2>კატეგორიები</h2>
      {cats.map((c) => (
        <div key={c.id} className="row">
          <input style={{ maxWidth: 260 }} defaultValue={c.name_ka} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name_ka && upd(c, { name_ka: e.target.value.trim() })} />
          <input style={{ width: 80 }} type="number" defaultValue={c.sort_order} onBlur={(e) => Number(e.target.value) !== c.sort_order && upd(c, { sort_order: Number(e.target.value) || 0 })} />
          <span className="small muted">რიგი</span>
        </div>
      ))}
      <div className="row">
        <input style={{ maxWidth: 260 }} placeholder="ახალი კატეგორია" value={name} onChange={(e) => setName(e.target.value)} />
        <button disabled={busy || !name.trim()} onClick={() => run(async () => { ok(await supabase.from('categories').insert({ name_ka: name.trim(), sort_order: cats.length + 1 }).select('id')); setName(''); onSaved(); })}>დამატება</button>
      </div>
      {note}
    </div>
  );
}

export default function Products() {
  const { data, error, reload } = useLoad(async () => {
    const [cats, prods, brs, bps] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order').then(ok<Cat[]>),
      supabase.from('products').select('id,category_id,name,description_ka,price_tetri,old_price_tetri,price_source,is_active,sort_order').order('sort_order').then(ok<Prod[]>),
      supabase.rpc('admin_branches').then(ok<Br[]>),
      supabase.from('branch_products').select('branch_id,product_id,is_available').then(ok<BP[]>),
    ]);
    return { cats, prods, brs, bps };
  });
  const [bid, setBid] = useState('');
  const [filter, setFilter] = useState('');
  const { busy, run, note } = useAction();

  if (!data) return <div className="stack"><h1>პროდუქტები და ფასები</h1>{error ? <div className="err">{error}</div> : <p className="muted">იტვირთება…</p>}</div>;
  const branch = bid || data.brs[0]?.id || '';
  const avail = (pid: string) => data.bps.find((x) => x.branch_id === branch && x.product_id === pid)?.is_available ?? false;
  const toggle = (pid: string, v: boolean) => run(async () => {
    ok(await supabase.from('branch_products').upsert({ branch_id: branch, product_id: pid, is_available: v }, { onConflict: 'branch_id,product_id' }).select('product_id'));
    await reload();
  }, 'შენახულია ✓');
  const shown = data.prods.filter((p) => !filter || p.category_id === filter);
  const unapproved = data.prods.filter((p) => p.is_active && p.price_source !== 'approved').length;

  return (
    <div className="stack">
      <div><h1>პროდუქტები და ფასები</h1><p className="muted">ფასი ლარში (მაგ. 17.46). „ფასი დამტკიცებულია“ — სანამ ეს არ არის, აპში ჩანს შენიშვნა, რომ ფასები დასადასტურებელია.</p></div>
      {error ? <div className="err">{error}</div> : null}
      {unapproved > 0 ? <div className="card row" style={{ justifyContent: 'space-between' }}><span>{unapproved} პროდუქტის ფასი ჯერ არ არის დამტკიცებული.</span>
        <button disabled={busy} onClick={() => run(async () => { ok(await supabase.from('products').update({ price_source: 'approved' }).eq('is_active', true).neq('price_source', 'approved').select('id')); await reload(); }, 'ყველა დამტკიცდა ✓')}>ყველას დამტკიცება</button></div> : null}

      <Categories cats={data.cats} onSaved={reload} />

      <div className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>პროდუქტები ({shown.length})</h2>
          <select style={{ maxWidth: 220 }} value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">ყველა კატეგორია</option>{data.cats.map((c) => <option key={c.id} value={c.id}>{c.name_ka}</option>)}</select>
        </div>
        <div className="tblwrap"><table><tbody>
          <ProductEdit key={'new' + data.prods.length} p={null} cats={data.cats} onSaved={reload} />
          {shown.map((p) => <ProductEdit key={p.id + p.price_tetri + p.price_source} p={p} cats={data.cats} onSaved={reload} />)}
        </tbody></table></div>
      </div>

      <div className="card stack">
        <h2>რა არის ფილიალში ხელმისაწვდომი</h2>
        <p className="small muted">გამორთულია = „ამოიწურა“ ამ ფილიალის მენიუში. (ფილიალის პანელიდანაც იცვლება, როცა მას დავამატებთ.)</p>
        <Field label="ფილიალი"><select style={{ maxWidth: 300 }} value={branch} onChange={(e) => setBid(e.target.value)}>{data.brs.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        {note}
        <div className="grid2">
          {data.prods.filter((p) => p.is_active).map((p) => (
            <label key={p.id} className="chk"><input type="checkbox" disabled={busy} checked={avail(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} />{p.name}</label>
          ))}
        </div>
      </div>
    </div>
  );
}
