'use client';
import { useCallback, useEffect, useState } from 'react';
import { ok, supabase } from '@/lib/supabase';
import { gel } from '@/lib/format';
import { useBranch } from '@/components/branchctx';

interface Row { id: string; number: string; status: string; payment_method: 'card' | 'cash'; total_tetri: number; created_at: string; address_snapshot: { street?: string }; order_items: { name_snapshot: string; quantity: number }[] }
const LABEL: Record<string, string> = { out_for_delivery: 'კურიერთანაა', delivered: 'მიტანილია', cancelled: 'გაუქმებულია', rejected: 'უარყოფილია' };
const dayStr = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Tbilisi' });

export default function History() {
  const { branch } = useBranch();
  const [day, setDay] = useState(dayStr(new Date()));
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!branch) return;
    try {
      const from = new Date(`${day}T00:00:00+04:00`); const to = new Date(from.getTime() + 86400000);
      setRows(ok(await supabase.from('orders').select('id,number,status,payment_method,total_tetri,created_at,address_snapshot,order_items(name_snapshot,quantity)')
        .eq('branch_id', branch.id).in('status', ['out_for_delivery', 'delivered', 'cancelled', 'rejected']).gte('created_at', from.toISOString()).lt('created_at', to.toISOString()).order('created_at', { ascending: false }) as { data: Row[] | null; error: { message: string } | null }));
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [branch, day]);
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);
  const delivered = rows.filter((r) => r.status === 'delivered');
  const sum = delivered.reduce((s, r) => s + r.total_tetri, 0);
  return (
    <div className="stack">
      <div className="topbar">
        <div><h1>ისტორია</h1><p className="muted">გადაცემული და დასრულებული შეკვეთები. {branch?.name}</p></div>
        <input type="date" value={day} onChange={(e) => setDay(e.target.value)} style={{ width: 180 }} />
      </div>
      {error ? <div className="err">{error}</div> : null}
      <div className="row"><span className="pill ok">მიტანილი: {delivered.length}</span><span className="pill">თანხა: {gel(sum)}</span><span className="pill bad">გაუქმებული/უარყოფილი: {rows.filter((r) => r.status === 'cancelled' || r.status === 'rejected').length}</span></div>
      <div className="card"><div className="tblwrap"><table>
        <thead><tr><th>№</th><th>დრო</th><th>შეკვეთა</th><th>მისამართი</th><th>გადახდა</th><th>თანხა</th><th>სტატუსი</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.number}</td><td>{new Date(r.created_at).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tbilisi' })}</td>
              <td>{r.order_items.map((i) => `${i.quantity}× ${i.name_snapshot}`).join(', ')}</td><td>{r.address_snapshot?.street ?? '—'}</td>
              <td>{r.payment_method === 'card' ? 'ბარათი' : 'ნაღდი'}</td><td>{gel(r.total_tetri)}</td>
              <td><span className={`pill ${r.status === 'delivered' ? 'ok' : r.status === 'out_for_delivery' ? 'warn' : 'bad'}`}>{LABEL[r.status]}</span></td>
            </tr>
          ))}
          {rows.length === 0 ? <tr><td colSpan={7} className="muted">ამ დღეს ჩანაწერი არ არის</td></tr> : null}
        </tbody>
      </table></div></div>
    </div>
  );
}
