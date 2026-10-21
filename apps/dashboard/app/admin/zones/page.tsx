'use client';
import { useState } from 'react';
import { ok, supabase } from '@/lib/supabase';
import { fromTetri, gel, toTetri } from '@/lib/format';
import { Field, useAction, useLoad } from '@/components/bits';

interface Br { id: string; name: string; lat: number | null; lng: number | null }
interface Zone { id: string; branch_id: string; name: string; fee_tetri: number | null; min_order_tetri: number; free_from_tetri: number | null; extra_minutes: number; is_active: boolean; center_lat: number | null; center_lng: number | null; radius_m: number | null }

function ZoneForm({ zone, branches, branchId, onDone }: { zone: Zone | null; branches: Br[]; branchId: string; onDone: () => void }) {
  const br = branches.find((b) => b.id === (zone?.branch_id ?? branchId));
  const [name, setName] = useState(zone?.name ?? '');
  const [bid, setBid] = useState(zone?.branch_id ?? branchId);
  const [lat, setLat] = useState((zone?.center_lat ?? br?.lat)?.toString() ?? '');
  const [lng, setLng] = useState((zone?.center_lng ?? br?.lng)?.toString() ?? '');
  const [radius, setRadius] = useState((zone?.radius_m ?? 3000).toString());
  const [fee, setFee] = useState(fromTetri(zone?.fee_tetri));
  const [min, setMin] = useState(fromTetri(zone?.min_order_tetri ?? 0));
  const [free, setFree] = useState(fromTetri(zone?.free_from_tetri));
  const [extra, setExtra] = useState((zone?.extra_minutes ?? 0).toString());
  const [active, setActive] = useState(zone?.is_active ?? true);
  const { busy, run, note } = useAction();

  const save = () => run(async () => {
    const f = toTetri(fee), m = toTetri(min), fr = toTetri(free);
    if ([f, m, fr].some((x) => x !== null && Number.isNaN(x))) throw new Error('თანხა არასწორია');
    const la = Number(lat.replace(',', '.')), lo = Number(lng.replace(',', '.')), r = Number(radius);
    if (!name.trim()) throw new Error('ზონას სახელი სჭირდება');
    if (!bid) throw new Error('აირჩიე ფილიალი');
    if (!Number.isFinite(la) || !Number.isFinite(lo) || lat === '' || lng === '') throw new Error('ზონის ცენტრის კოორდინატები აუცილებელია');
    if (!Number.isInteger(r) || r < 100 || r > 30000) throw new Error('რადიუსი 100–30000 მეტრი უნდა იყოს');
    ok(await supabase.rpc('admin_save_zone', { p_id: zone?.id ?? null, p_branch: bid, p_name: name.trim(), p_lat: la, p_lng: lo, p_radius_m: r, p_fee_tetri: f, p_min_order_tetri: m ?? 0, p_free_from_tetri: fr, p_extra_minutes: Math.max(0, Number(extra) || 0), p_active: active }));
    onDone();
  });
  const del = () => run(async () => {
    if (!zone) return;
    if (!window.confirm('წავშალო ზონა? არსებული შეკვეთები ამის გამო არ დაზიანდება, მაგრამ თუ ზონაზე შეკვეთები არსებობს, წაშლა შეუძლებელია — მაშინ გამორთე.')) return;
    const { error } = await supabase.from('delivery_zones').delete().eq('id', zone.id);
    if (error) throw new Error('ზონაზე უკვე არის შეკვეთები. გამორთე „აქტიურია“.');
    onDone();
  }, 'წაშლილია');

  return (
    <div className="card stack" style={{ borderColor: zone ? 'var(--border)' : 'var(--brand)' }}>
      <h2>{zone ? zone.name : 'ახალი ზონა'}</h2>
      <div className="grid2">
        <Field label="ზონის სახელი"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="დიღომი, 3 კმ" /></Field>
        {!zone ? <Field label="ფილიალი"><select value={bid} onChange={(e) => setBid(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field> : null}
        <Field label="ცენტრი: განედი"><input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" /></Field>
        <Field label="ცენტრი: გრძედი"><input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" /></Field>
        <Field label="რადიუსი (მეტრი)"><input value={radius} onChange={(e) => setRadius(e.target.value)} inputMode="numeric" /></Field>
        <Field label="მიტანის ფასი (₾)"><input value={fee} onChange={(e) => setFee(e.target.value)} inputMode="decimal" placeholder="ცარიელი = ჯერ არ არის დამტკიცებული" /></Field>
        <Field label="მინიმალური შეკვეთა (₾)"><input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" /></Field>
        <Field label="უფასო მიტანა ამ თანხიდან (₾)"><input value={free} onChange={(e) => setFree(e.target.value)} inputMode="decimal" placeholder="ცარიელი = არასდროს" /></Field>
        <Field label="დამატებითი წუთები"><input value={extra} onChange={(e) => setExtra(e.target.value)} inputMode="numeric" /></Field>
      </div>
      <label className="chk"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />აქტიურია</label>
      {fee.trim() === '' ? <div className="err">მიტანის ფასი ცარიელია: ამ ზონაში შეკვეთა დაიბლოკება, სანამ ფასს არ შეიყვან.</div> : null}
      {note}
      <div className="row"><button disabled={busy} onClick={save}>{busy ? '…' : 'შენახვა'}</button>{zone ? <button className="ghost" disabled={busy} onClick={del}>წაშლა</button> : <button className="ghost" onClick={onDone}>გაუქმება</button>}</div>
    </div>
  );
}

export default function Zones() {
  const { data, error, reload } = useLoad(async () => {
    const [branches, zones] = await Promise.all([
      supabase.rpc('admin_branches').then(ok<Br[]>),
      supabase.from('delivery_zones').select('id,branch_id,name,fee_tetri,min_order_tetri,free_from_tetri,extra_minutes,is_active,center_lat,center_lng,radius_m').order('name').then(ok<Zone[]>),
    ]);
    return { branches, zones };
  });
  const [sel, setSel] = useState('');
  const [adding, setAdding] = useState(false);
  const bid = sel || data?.branches[0]?.id || '';
  const zs = (data?.zones ?? []).filter((z) => z.branch_id === bid);
  const done = () => { setAdding(false); reload(); };

  return (
    <div className="stack">
      <div><h1>ზონები და მიტანა</h1><p className="muted">თითო ზონა არის წრე (ცენტრი + რადიუსი). ფასი, მინიმალური შეკვეთა და უფასო მიტანის ზღვარი ზონაზეა.</p></div>
      {error ? <div className="err">{error}</div> : null}
      {data && data.branches.length === 0 ? <div className="err">ჯერ დაამატე ფილიალი.</div> : null}
      {data && data.branches.length > 0 ? (
        <>
          <div className="row">
            <Field label="ფილიალი"><select value={bid} onChange={(e) => { setSel(e.target.value); setAdding(false); }} style={{ minWidth: 260 }}>{data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <button onClick={() => setAdding(true)} disabled={adding} style={{ alignSelf: 'flex-end' }}>+ ახალი ზონა</button>
          </div>
          {adding ? <ZoneForm zone={null} branches={data.branches} branchId={bid} onDone={done} /> : null}
          {zs.map((z) => <ZoneForm key={z.id + String(z.fee_tetri) + z.radius_m} zone={z} branches={data.branches} branchId={bid} onDone={reload} />)}
          {zs.length === 0 && !adding ? <p className="muted">ამ ფილიალს ზონა ჯერ არ აქვს. მიტანა მუშაობს მხოლოდ ზონაში.</p> : null}
          <p className="small muted">მიმდინარე ფასები: {zs.map((z) => `${z.name} ${gel(z.fee_tetri)}`).join(' · ') || '—'}</p>
        </>
      ) : null}
    </div>
  );
}
