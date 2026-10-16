'use client';
import { useCallback, useEffect, useState } from 'react';
import { ok, supabase } from '@/lib/supabase';
import { gel } from '@/lib/format';
import { useAction } from '@/components/bits';

interface Snap { street?: string; entrance?: string | null; floor?: string | null; apartment?: string | null; comment?: string | null }
interface Job { id: string; number: string; branch_name: string; address_snapshot: Snap; phone: string | null; full_name: string | null; total_tetri: number; payment_method: 'card' | 'cash'; payment_status: string; created_at: string }

export default function Courier() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState('');
  const { busy, run, note } = useAction();
  const load = useCallback(async () => {
    try { setJobs(ok(await supabase.rpc('courier_deliveries') as { data: Job[] | null; error: { message: string } | null })); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]);
  const done = (j: Job) => run(async () => {
    if (!window.confirm(`${j.number}: მიტანილია?`)) return;
    ok(await supabase.rpc('courier_mark_delivered', { p_order_id: j.id })); await load();
  }, 'მიტანილია ✓');

  return (
    <div className="stack">
      <div className="topbar"><div><h1>მიტანები</h1><p className="muted">რესტორნიდან გადმოცემული შეკვეთები. მიტანის შემდეგ დააჭირე „მიტანილია“</p></div></div>
      {error ? <div className="err">{error}</div> : null}
      {note}
      <div className="stack" style={{ maxWidth: 520 }}>
        {jobs.map((j) => {
          const a = j.address_snapshot ?? {};
          const where = [a.street, a.entrance && `სადარბაზო ${a.entrance}`, a.floor && `სართული ${a.floor}`, a.apartment && `ბინა ${a.apartment}`].filter(Boolean).join(', ');
          return (
            <article key={j.id} className="ocard">
              <div className="head"><span className="num">№{j.number}</span><span className="sub">{j.branch_name}</span></div>
              <div><b>📍 {where || '—'}</b></div>
              {a.comment ? <div className="sub">💬 {a.comment}</div> : null}
              {j.phone ? <div className="sub">📞 <b style={{ color: 'var(--text)' }}>{j.phone}</b>{j.full_name ? ` · ${j.full_name}` : ''}</div> : null}
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span className={`pill ${j.payment_method === 'card' ? 'ok' : 'warn'}`}>{j.payment_method === 'card' ? 'გადახდილია ბარათით' : `ნაღდი: აიღე ${gel(j.total_tetri)}`}</span>
                <b>{gel(j.total_tetri)}</b>
              </div>
              <div className="acts"><button disabled={busy} onClick={() => done(j)}>მიტანილია</button></div>
            </article>
          );
        })}
        {jobs.length === 0 ? <p className="muted">ახლა გასატანი შეკვეთა არ არის.</p> : null}
      </div>
    </div>
  );
}
