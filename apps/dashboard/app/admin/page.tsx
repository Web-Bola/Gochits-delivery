'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ok, supabase } from '@/lib/supabase';
import { daysAgo, gel, today } from '@/lib/format';
import { Field, useLoad } from '@/components/bits';

interface Br { id: string; code: string; name: string; address: string | null; phone: string | null; lat: number | null; is_active: boolean; accepts_orders: boolean }
interface Row { day: string; branch_id: string; branch_name: string; orders: number; revenue_tetri: number; delivery_tetri: number; discount_tetri: number }

export default function Dashboard() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(today());

  const ready = useLoad(async () => {
    const [branches, hours, zones, products, demo] = await Promise.all([
      supabase.rpc('admin_branches').then(ok<Br[]>),
      supabase.from('branch_hours').select('branch_id').then(ok<{ branch_id: string }[]>),
      supabase.from('delivery_zones').select('branch_id,fee_tetri,is_active').then(ok<{ branch_id: string; fee_tetri: number | null; is_active: boolean }[]>),
      supabase.from('products').select('price_source,is_active').then(ok<{ price_source: string; is_active: boolean }[]>),
      supabase.from('app_settings').select('value').eq('key', 'demo_mode').maybeSingle().then(ok<{ value: string } | null>),
    ]);
    return { branches, hours, zones, unapproved: products.filter((p) => p.is_active && p.price_source !== 'approved').length, demo: demo?.value === 'true' };
  });
  const rep = useLoad(async () => ok(await supabase.rpc('admin_report', { p_from: from, p_to: to }) as { data: Row[] | null; error: { message: string } | null }));

  const rows = rep.data ?? [];
  const total = rows.reduce((a, r) => ({ n: a.n + Number(r.orders), s: a.s + Number(r.revenue_tetri) }), { n: 0, s: 0 });

  return (
    <div className="stack">
      <div><h1>მთავარი</h1><p className="muted">რა აკლია აპს რეალური შეკვეთებისთვის და გაყიდვების ანგარიში</p></div>
      {ready.error ? <div className="err">{ready.error}</div> : null}

      <div className="card stack">
        <h2>გაშვების მზადყოფნა</h2>
        {ready.data ? (
          <>
            {ready.data.branches.length === 0 ? <p className="muted">ფილიალი ჯერ არ არის. დაამატე <Link href="/admin/branches" style={{ color: 'var(--yellow)' }}>ფილიალები</Link> გვერდზე.</p> : null}
            <div className="tblwrap"><table>
              <thead><tr><th>ფილიალი</th><th>მისამართი</th><th>ტელეფონი</th><th>კოორდინატები</th><th>საათები</th><th>ზონა + ფასი</th><th>იღებს შეკვეთებს</th></tr></thead>
              <tbody>
                {ready.data.branches.map((b) => {
                  const hasHours = ready.data!.hours.some((h) => h.branch_id === b.id);
                  const zs = ready.data!.zones.filter((z) => z.branch_id === b.id && z.is_active);
                  const priced = zs.some((z) => z.fee_tetri != null);
                  const pill = (good: boolean, yes = 'კი', no = 'არა') => <span className={`pill ${good ? 'ok' : 'bad'}`}>{good ? yes : no}</span>;
                  return (
                    <tr key={b.id}>
                      <td><b>{b.name}</b> <span className="muted small">{b.code}</span></td>
                      <td>{pill(!!b.address)}</td><td>{pill(!!b.phone)}</td><td>{pill(b.lat != null)}</td><td>{pill(hasHours)}</td>
                      <td>{pill(priced, `${zs.length} ზონა`, zs.length ? 'ფასი არ არის' : 'ზონა არ არის')}</td>
                      <td>{pill(b.accepts_orders && b.is_active, 'ჩართულია', 'გამორთულია')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
            <div className="row">
              <span className={`pill ${ready.data.unapproved === 0 ? 'ok' : 'warn'}`}>{ready.data.unapproved === 0 ? 'ყველა ფასი დამტკიცებულია' : `${ready.data.unapproved} პროდუქტის ფასი არ არის დამტკიცებული`}</span>
              <span className={`pill ${ready.data.demo ? 'warn' : 'ok'}`}>{ready.data.demo ? 'სატესტო რეჟიმი ჩართულია' : 'სატესტო რეჟიმი გამორთულია'}</span>
            </div>
          </>
        ) : <p className="muted">იტვირთება…</p>}
      </div>

      <div className="card stack">
        <h2>გაყიდვები</h2>
        <div className="row">
          <Field label="დან"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="მდე"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <button className="ghost" onClick={rep.reload} style={{ alignSelf: 'flex-end' }}>განახლება</button>
        </div>
        {rep.error ? <div className="err">{rep.error}</div> : null}
        <div className="row"><span className="pill ok">{total.n} შეკვეთა</span><span className="pill ok">{gel(total.s)}</span></div>
        <div className="tblwrap"><table>
          <thead><tr><th>თარიღი</th><th>ფილიალი</th><th>შეკვეთა</th><th>თანხა</th><th>მიტანა</th><th>ფასდაკლება</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.day + r.branch_id}><td>{r.day}</td><td>{r.branch_name}</td><td>{r.orders}</td><td>{gel(Number(r.revenue_tetri))}</td><td>{gel(Number(r.delivery_tetri))}</td><td>{gel(Number(r.discount_tetri))}</td></tr>)}
            {rows.length === 0 && rep.data ? <tr><td colSpan={6} className="muted">ამ პერიოდში შეკვეთა არ არის</td></tr> : null}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
