'use client';
import { useEffect, useState } from 'react';
import { ok, supabase } from '@/lib/supabase';
import { WEEK } from '@/lib/format';
import { Field, useAction, useLoad } from '@/components/bits';

interface Br { id: string | null; code: string; name: string; address: string | null; phone: string | null; lat: number | null; lng: number | null; is_active: boolean; accepts_orders: boolean; cod_enabled: boolean }
interface Hr { branch_id: string; weekday: number; opens: string; closes: string }
const EMPTY: Br = { id: null, code: '', name: '', address: '', phone: '', lat: null, lng: null, is_active: true, accepts_orders: false, cod_enabled: false };
const hhmm = (t: string) => t.slice(0, 5);

function BranchForm({ branch, hours, onSaved }: { branch: Br; hours: Hr[]; onSaved: () => void }) {
  const [b, setB] = useState(branch);
  const [lat, setLat] = useState(branch.lat?.toString() ?? '');
  const [lng, setLng] = useState(branch.lng?.toString() ?? '');
  const [week, setWeek] = useState(() => Array.from({ length: 7 }, (_, d) => {
    const h = hours.find((x) => x.weekday === d);
    return { open: !!h, opens: h ? hhmm(h.opens) : '10:00', closes: h ? hhmm(h.closes) : '23:00' };
  }));
  const { busy, run, note } = useAction();
  useEffect(() => setB(branch), [branch]);
  const set = <K extends keyof Br>(k: K, v: Br[K]) => setB((x) => ({ ...x, [k]: v }));

  const save = () => run(async () => {
    const la = lat.trim() === '' ? null : Number(lat.replace(',', '.')); const lo = lng.trim() === '' ? null : Number(lng.replace(',', '.'));
    if ((la === null) !== (lo === null) || Number.isNaN(la) || Number.isNaN(lo)) throw new Error('კოორდინატები: შეავსე ორივე (განედი და გრძედი) ან არც ერთი');
    if (!b.name.trim()) throw new Error('სახელი აუცილებელია');
    if (!b.id && !/^[A-Za-z0-9]{1,6}$/.test(b.code.trim())) throw new Error('კოდი: 1–6 ლათინური ასო/ციფრი (მაგ. B1)');
    const id = ok(await supabase.rpc('admin_save_branch', { p_id: b.id, p_code: b.code, p_name: b.name.trim(), p_address: b.address ?? '', p_phone: b.phone ?? '', p_lat: la, p_lng: lo, p_is_active: b.is_active, p_accepts_orders: b.accepts_orders, p_cod_enabled: b.cod_enabled })) as string;
    ok(await supabase.rpc('admin_save_hours', { p_branch: id, p_hours: week.map((w, d) => (w.open ? { weekday: d, opens: w.opens, closes: w.closes } : null)).filter(Boolean) }));
    onSaved();
  });

  return (
    <div className="card stack">
      <h2>{b.id ? b.name || 'ფილიალი' : 'ახალი ფილიალი'}</h2>
      <div className="grid2">
        <Field label="კოდი (შეკვეთის ნომრის პრეფიქსი)"><input value={b.code} disabled={!!b.id} onChange={(e) => set('code', e.target.value)} placeholder="B1" /></Field>
        <Field label="სახელი"><input value={b.name} onChange={(e) => set('name', e.target.value)} placeholder="გოჩიტ'ს დიღომი" /></Field>
        <Field label="მისამართი"><input value={b.address ?? ''} onChange={(e) => set('address', e.target.value)} /></Field>
        <Field label="ტელეფონი"><input value={b.phone ?? ''} onChange={(e) => set('phone', e.target.value)} placeholder="+995 ..." /></Field>
        <Field label="განედი (lat)"><input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="41.7951" inputMode="decimal" /></Field>
        <Field label="გრძედი (lng)"><input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="44.7684" inputMode="decimal" /></Field>
      </div>
      <p className="small muted">კოორდინატები: Google Maps-ში ფილიალზე მარჯვენა ღილაკი → პირველი რიცხვი განედია, მეორე გრძედი.</p>
      <div className="row" style={{ gap: 22 }}>
        <label className="chk"><input type="checkbox" checked={b.is_active} onChange={(e) => set('is_active', e.target.checked)} />აქტიურია</label>
        <label className="chk"><input type="checkbox" checked={b.accepts_orders} onChange={(e) => set('accepts_orders', e.target.checked)} />იღებს შეკვეთებს</label>
        <label className="chk"><input type="checkbox" checked={b.cod_enabled} onChange={(e) => set('cod_enabled', e.target.checked)} />ნაღდი ფული კურიერთან</label>
      </div>
      <div>
        <h2 style={{ fontSize: 15 }}>სამუშაო საათები</h2>
        <div className="stack" style={{ gap: 8 }}>
          {week.map((w, d) => (
            <div key={d} className="row">
              <label className="chk" style={{ width: 150 }}><input type="checkbox" checked={w.open} onChange={(e) => setWeek((x) => x.map((y, i) => (i === d ? { ...y, open: e.target.checked } : y)))} />{WEEK[d]}</label>
              {w.open ? (
                <>
                  <input type="time" style={{ width: 130 }} value={w.opens} onChange={(e) => setWeek((x) => x.map((y, i) => (i === d ? { ...y, opens: e.target.value } : y)))} />
                  <span className="muted">–</span>
                  <input type="time" style={{ width: 130 }} value={w.closes} onChange={(e) => setWeek((x) => x.map((y, i) => (i === d ? { ...y, closes: e.target.value } : y)))} />
                </>
              ) : <span className="muted small">დაკეტილია</span>}
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>დახურვის დრო გახსნის დროზე ადრე = მუშაობს შუაღამის შემდეგაც (მაგ. 12:00–02:00).</p>
      </div>
      {note}
      <div><button disabled={busy} onClick={save}>{busy ? '…' : 'შენახვა'}</button></div>
    </div>
  );
}

export default function Branches() {
  const { data, error, reload } = useLoad(async () => {
    const [branches, hours] = await Promise.all([
      supabase.rpc('admin_branches').then(ok<Br[]>),
      supabase.from('branch_hours').select('*').then(ok<Hr[]>),
    ]);
    return { branches, hours };
  });
  const [adding, setAdding] = useState(false);
  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div><h1>ფილიალები</h1><p className="muted">მისამართი, ტელეფონი, კოორდინატები, სამუშაო საათები, შეკვეთების ჩართვა</p></div>
        <button onClick={() => setAdding(true)} disabled={adding}>+ ახალი ფილიალი</button>
      </div>
      {error ? <div className="err">{error}</div> : null}
      {adding ? <BranchForm branch={EMPTY} hours={[]} onSaved={() => { setAdding(false); reload(); }} /> : null}
      {data?.branches.map((b) => <BranchForm key={b.id} branch={b} hours={data.hours.filter((h) => h.branch_id === b.id)} onSaved={reload} />)}
      {data && data.branches.length === 0 && !adding ? <p className="muted">ფილიალი ჯერ არ არის.</p> : null}
    </div>
  );
}
