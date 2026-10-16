'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ok, supabase } from '@/lib/supabase';
import { gel } from '@/lib/format';
import { useAction } from '@/components/bits';
import { useBranch } from '@/components/branchctx';

interface Item { name_snapshot: string; quantity: number; unit_price_tetri: number; note: string | null }
interface Snap { street?: string; entrance?: string | null; floor?: string | null; apartment?: string | null; comment?: string | null; deleted?: boolean }
interface Order {
  id: string; number: string; status: string; payment_method: 'card' | 'cash'; payment_status: string; total_tetri: number; subtotal_tetri: number;
  delivery_fee_tetri: number; discount_tetri: number; notes: string | null; address_snapshot: Snap; created_at: string; order_items: Item[];
}
interface Courier { order_id: string; courier_name: string | null; courier_phone: string | null }
interface Contact { order_id: string; phone: string | null; full_name: string | null }

const COLS: { key: string; title: string; statuses: string[] }[] = [
  { key: 'new', title: 'ახალი', statuses: ['placed'] },
  { key: 'cook', title: 'მზადდება', statuses: ['accepted', 'preparing'] },
  { key: 'go', title: 'მზადაა, კურიერს ელოდება', statuses: ['ready_for_pickup'] },
];
// [button label, next status, style]
const ACTIONS: Record<string, [string, string, string][]> = {
  placed: [['მიღება', 'accepted', ''], ['უარყოფა', 'rejected', 'red']],
  accepted: [['მზადაა', 'ready_for_pickup', ''], ['გაუქმება', 'cancelled', 'ghost']],
  preparing: [['მზადაა', 'ready_for_pickup', ''], ['გაუქმება', 'cancelled', 'ghost']],
};
const ago = (iso: string) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? 'ახლახან' : m < 60 ? `${m} წთ წინ` : `${Math.floor(m / 60)} სთ ${m % 60} წთ წინ`; };

function beep() {
  try {
    const A = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new A(); const t = ctx.currentTime;
    [0, 0.22, 0.44].forEach((d, i) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = i === 2 ? 1046 : 784; o.connect(g); g.connect(ctx.destination); g.gain.setValueAtTime(0.2, t + d); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.2); o.start(t + d); o.stop(t + d + 0.2); });
  } catch { /* sound not available */ }
}

export default function Orders() {
  const { branches, branch, setBranchId, reload: reloadBranches } = useBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [contacts, setContacts] = useState<Record<string, Contact>>({});
  const [couriers, setCouriers] = useState<Record<string, Courier>>({});
  const [error, setError] = useState('');
  const [sound, setSound] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);
  const soundRef = useRef(false);
  const { busy, run, note } = useAction();
  soundRef.current = sound;

  const load = useCallback(async () => {
    if (!branch) return;
    try {
      const since = new Date(Date.now() - 2 * 86400000).toISOString();
      const rows = ok(await supabase.from('orders')
        .select('id,number,status,payment_method,payment_status,total_tetri,subtotal_tetri,delivery_fee_tetri,discount_tetri,notes,address_snapshot,created_at,order_items(name_snapshot,quantity,unit_price_tetri,note)')
        .eq('branch_id', branch.id).gte('created_at', since).in('status', ['placed', 'accepted', 'preparing', 'ready_for_pickup']).order('created_at', { ascending: false }) as { data: Order[] | null; error: { message: string } | null });
      const c = ok(await supabase.rpc('staff_contacts', { p_branch: branch.id }) as { data: Contact[] | null; error: { message: string } | null });
      setContacts(Object.fromEntries(c.map((x) => [x.order_id, x])));
      const cr = ok(await supabase.rpc('staff_order_couriers', { p_branch: branch.id }) as { data: Courier[] | null; error: { message: string } | null });
      setCouriers(Object.fromEntries(cr.map((x) => [x.order_id, x])));
      setOrders(rows);
      setError('');
      const newIds = rows.filter((o) => o.status === 'placed').map((o) => o.id);
      if (seen.current === null) seen.current = new Set(newIds);
      else {
        const added = newIds.filter((id) => !seen.current!.has(id));
        if (added.length) { setFresh((f) => new Set([...f, ...added])); if (soundRef.current) beep(); }
        newIds.forEach((id) => seen.current!.add(id));
      }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, [branch]);

  useEffect(() => { seen.current = null; setOrders([]); load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]);
  useEffect(() => {
    if (!branch) return;
    const ch = supabase.channel('orders-' + branch.id).on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `branch_id=eq.${branch.id}` }, () => { load(); }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [branch, load]);
  useEffect(() => {
    const n = orders.filter((o) => o.status === 'placed').length;
    document.title = n > 0 ? `(${n}) ახალი შეკვეთა · Gochit's` : "Gochit's პანელი";
    return () => { document.title = "Gochit's პანელი"; };
  }, [orders]);

  const move = (o: Order, to: string) => run(async () => {
    if ((to === 'rejected' || to === 'cancelled') && !window.confirm(`${o.number}: ${to === 'rejected' ? 'უარვყოთ' : 'გავაუქმოთ'} შეკვეთა?${o.payment_status === 'paid' ? ' შეკვეთა ბარათით არის გადახდილი, თანხის დაბრუნება ცალკე უნდა მოგვარდეს.' : ''}`)) return;
    ok(await supabase.rpc('transition_order', { p_order_id: o.id, p_to: to }));
    setFresh((f) => { const n = new Set(f); n.delete(o.id); return n; });
    await load();
  }, 'სტატუსი შეიცვალა ✓');

  const toggleAccepting = () => run(async () => {
    if (!branch) return;
    ok(await supabase.rpc('staff_set_accepting', { p_branch: branch.id, p_on: !branch.accepts_orders }));
    await reloadBranches();
  }, 'შენახულია ✓');


  return (
    <div className="stack">
      <div className="topbar">
        <div><h1>შეკვეთები</h1><p className="muted">ახალი შეკვეთა ავტომატურად გამოჩნდება. როცა კურიერი შეკვეთას აიღებს, დაფიდან გაქრება და „ისტორიაში“ გამოჩნდება</p></div>
        <div className="row">
          {branches.length > 1 ? <select style={{ width: 240 }} value={branch?.id} onChange={(e) => setBranchId(e.target.value)}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select> : <b>{branch?.name}</b>}
          <button className={branch?.accepts_orders ? 'ghost' : 'red'} disabled={busy} onClick={toggleAccepting}>{branch?.accepts_orders ? '⏸ შეკვეთების გაჩერება' : '▶ შეკვეთების მიღების ჩართვა'}</button>
          <button className={sound ? '' : 'ghost'} onClick={() => { setSound((v) => !v); if (!sound) beep(); }}>{sound ? '🔔 ხმა ჩართულია' : '🔕 ხმის ჩართვა'}</button>
        </div>
      </div>
      {branch && !branch.accepts_orders ? <div className="err">ამ ფილიალში შეკვეთების მიღება გაჩერებულია. მომხმარებლები ახალ შეკვეთას ვერ გააკეთებენ.</div> : null}
      {error ? <div className="err">{error}</div> : null}
      {note}
      <div className="board">
        {COLS.map((c) => {
          const list = orders.filter((o) => c.statuses.includes(o.status));
          return (
            <section key={c.key} className="col">
              <h2>{c.title}<span className="count">{list.length}</span></h2>
              {list.map((o) => {
                const a = o.address_snapshot ?? {};
                const ct = contacts[o.id];
                const where = [a.street, a.entrance && `სადარბაზო ${a.entrance}`, a.floor && `სართული ${a.floor}`, a.apartment && `ბინა ${a.apartment}`].filter(Boolean).join(', ');
                return (
                  <article key={o.id} className={`ocard ${fresh.has(o.id) ? 'fresh' : ''}`}>
                    <div className="head"><span className="num">№{o.number}</span><span className="ago">{ago(o.created_at)}</span></div>
                    <ul>{o.order_items.map((it, i) => <li key={i}><b>{it.quantity}×</b><span>{it.name_snapshot}{it.note ? <span className="sub"> · {it.note}</span> : null}</span></li>)}</ul>
                    {o.notes ? <div className="note">💬 {o.notes}</div> : null}
                    <hr />
                    <div className="sub">📍 {where || '—'}{a.comment ? ` · ${a.comment}` : ''}</div>
                    {ct?.phone ? <div className="sub">📞 <b style={{ color: 'var(--text)' }}>{ct.phone}</b>{ct.full_name ? ` · ${ct.full_name}` : ''}</div> : null}
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className={`pill ${o.payment_method === 'card' ? 'ok' : 'warn'}`}>{o.payment_method === 'card' ? (o.payment_status === 'paid' ? 'ბარათით გადახდილია' : 'ბარათი: გადაუხდელი') : 'ნაღდი: მიიღეთ კურიერთან'}</span>
                      <b>{gel(o.total_tetri)}</b>
                    </div>
                    {couriers[o.id] ? <div className="sub">🛵 კურიერი: <b style={{ color: 'var(--text)' }}>{couriers[o.id].courier_name}</b>{couriers[o.id].courier_phone ? ` · ${couriers[o.id].courier_phone}` : ''}</div> : <div className="sub">🛵 კურიერი ჯერ არ არის აღებული{o.status === 'ready_for_pickup' ? '' : ' (დადასტურების შემდეგ კურიერებს გამოუჩნდება)'}</div>}
                    <div className="acts">{(ACTIONS[o.status] ?? []).map(([label, to, cls]) => <button key={to} className={cls} disabled={busy} onClick={() => move(o, to)}>{label}</button>)}</div>
                  </article>
                );
              })}
              {list.length === 0 ? <p className="small muted">—</p> : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
