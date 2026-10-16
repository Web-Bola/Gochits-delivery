'use client';
import { useState } from 'react';
import { ok, supabase } from '@/lib/supabase';
import { fromTetri, toTetri } from '@/lib/format';
import { Field, useAction, useLoad } from '@/components/bits';

interface Promo { code: string; percent_off: number | null; amount_off_tetri: number | null; min_subtotal_tetri: number; max_uses: number | null; used_count: number; valid_until: string | null; is_active: boolean; demo_only: boolean }

export default function Promos() {
  const { data, error, reload } = useLoad(async () => ok(await supabase.from('promo_codes').select('*').order('created_at', { ascending: false }) as { data: Promo[] | null; error: { message: string } | null }));
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'percent' | 'amount'>('percent');
  const [val, setVal] = useState('');
  const [min, setMin] = useState('');
  const [uses, setUses] = useState('');
  const [until, setUntil] = useState('');
  const { busy, run, note } = useAction();

  const create = () => run(async () => {
    const c = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,30}$/.test(c)) throw new Error('კოდი: 3–30 ლათინური ასო/ციფრი');
    const v = Number(val.replace(',', '.'));
    if (!Number.isFinite(v) || v <= 0) throw new Error('ფასდაკლების მნიშვნელობა არასწორია');
    if (kind === 'percent' && (v > 100 || !Number.isInteger(v))) throw new Error('პროცენტი 1–100 მთელი რიცხვი უნდა იყოს');
    const m = toTetri(min); if (Number.isNaN(m)) throw new Error('მინიმალური თანხა არასწორია');
    ok(await supabase.from('promo_codes').insert({
      code: c, percent_off: kind === 'percent' ? v : null, amount_off_tetri: kind === 'amount' ? Math.round(v * 100) : null,
      min_subtotal_tetri: m ?? 0, max_uses: uses ? Number(uses) : null, valid_until: until ? new Date(until + 'T23:59:59+04:00').toISOString() : null,
    }).select('code'));
    setCode(''); setVal(''); setMin(''); setUses(''); setUntil(''); await reload();
  }, 'კოდი შეიქმნა ✓');
  const patch = (c: string, p: Partial<Promo>) => run(async () => { ok(await supabase.from('promo_codes').update(p).eq('code', c).select('code')); await reload(); });
  const del = (c: string) => run(async () => { if (!window.confirm(`წავშალო ${c}?`)) return; ok(await supabase.from('promo_codes').delete().eq('code', c).select('code')); await reload(); }, 'წაშლილია');

  return (
    <div className="stack">
      <div><h1>პრომო კოდები</h1><p className="muted">კოდს კლიენტი კალათაში შეიყვანს. სერვერი ამოწმებს ვადას, ლიმიტს და მინიმალურ თანხას.</p></div>
      {error ? <div className="err">{error}</div> : null}
      <div className="card stack">
        <h2>ახალი კოდი</h2>
        <div className="grid2">
          <Field label="კოდი"><input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="WELCOME10" /></Field>
          <Field label="ტიპი"><select value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'amount')}><option value="percent">პროცენტი %</option><option value="amount">თანხა ₾</option></select></Field>
          <Field label={kind === 'percent' ? 'პროცენტი' : 'თანხა ₾'}><input value={val} onChange={(e) => setVal(e.target.value)} inputMode="decimal" /></Field>
          <Field label="მინიმალური შეკვეთა ₾"><input value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" /></Field>
          <Field label="მაქსიმალური გამოყენება"><input value={uses} onChange={(e) => setUses(e.target.value)} inputMode="numeric" placeholder="ცარიელი = შეუზღუდავი" /></Field>
          <Field label="მოქმედებს (დღემდე)"><input type="date" value={until} onChange={(e) => setUntil(e.target.value)} /></Field>
        </div>
        {note}
        <div><button disabled={busy} onClick={create}>შექმნა</button></div>
      </div>
      <div className="card"><div className="tblwrap"><table>
        <thead><tr><th>კოდი</th><th>ფასდაკლება</th><th>მინ. შეკვეთა</th><th>გამოყენებულია</th><th>ვადა</th><th>სტატუსი</th><th></th></tr></thead>
        <tbody>
          {data?.map((p) => (
            <tr key={p.code}>
              <td><b>{p.code}</b> {p.demo_only ? <span className="pill warn">სატესტო</span> : null}</td>
              <td>{p.percent_off != null ? `${p.percent_off}%` : `₾${fromTetri(p.amount_off_tetri)}`}</td>
              <td>₾{fromTetri(p.min_subtotal_tetri) || 0}</td>
              <td>{p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ''}</td>
              <td>{p.valid_until ? new Date(p.valid_until).toLocaleDateString('ka-GE') : '—'}</td>
              <td><span className={`pill ${p.is_active ? 'ok' : 'bad'}`}>{p.is_active ? 'აქტიური' : 'გამორთული'}</span></td>
              <td><div className="row"><button className="ghost" disabled={busy} onClick={() => patch(p.code, { is_active: !p.is_active })}>{p.is_active ? 'გამორთვა' : 'ჩართვა'}</button><button className="ghost" disabled={busy} onClick={() => del(p.code)}>წაშლა</button></div></td>
            </tr>
          ))}
          {data && data.length === 0 ? <tr><td colSpan={7} className="muted">კოდი ჯერ არ არის</td></tr> : null}
        </tbody>
      </table></div></div>
    </div>
  );
}
