'use client';
import { useState } from 'react';
import { ok, supabase } from '@/lib/supabase';
import { Field, useAction, useLoad } from '@/components/bits';

interface Staff { user_id: string; email: string; full_name: string | null; branch_id: string; branch_name: string }
interface Br { id: string; name: string }

export default function StaffPage() {
  const { data, error, reload } = useLoad(async () => {
    const [staff, branches] = await Promise.all([
      supabase.rpc('admin_staff').then(ok<Staff[]>),
      supabase.rpc('admin_branches').then(ok<Br[]>),
    ]);
    return { staff, branches };
  });
  const [email, setEmail] = useState('');
  const [bid, setBid] = useState('');
  const { busy, run, note } = useAction();
  const branch = bid || data?.branches[0]?.id || '';
  const add = () => run(async () => {
    if (!email.trim()) throw new Error('ჩაწერე ელფოსტა');
    const { error: e } = await supabase.rpc('admin_add_staff', { p_email: email.trim(), p_branch: branch });
    if (e) throw new Error(/user_not_found/.test(e.message) ? 'ამ ელფოსტით მომხმარებელი ვერ მოიძებნა. ჯერ Supabase → Authentication → Users → Add user.' : /already_admin/.test(e.message) ? 'ეს ანგარიში ადმინისტრატორია.' : e.message);
    setEmail(''); await reload();
  }, 'დაემატა ✓');
  const remove = (s: Staff) => run(async () => { if (!window.confirm(`${s.email}: მოვხსნა ${s.branch_name}-დან?`)) return; ok(await supabase.rpc('admin_remove_staff', { p_user: s.user_id, p_branch: s.branch_id })); await reload(); }, 'მოხსნილია');

  return (
    <div className="stack">
      <div><h1>თანამშრომლები</h1><p className="muted">რესტორნის პანელზე წვდომა: თანამშრომელი ხედავს და მართავს მხოლოდ თავისი ფილიალის შეკვეთებს</p></div>
      {error ? <div className="err">{error}</div> : null}
      <div className="card stack">
        <h2>თანამშრომლის დამატება</h2>
        <ol className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Supabase → Authentication → Users → <b>Add user</b> (ელფოსტა + პაროლი, „Auto Confirm User“ მონიშნე).</li>
          <li>აქ ჩაწერე იგივე ელფოსტა და აირჩიე ფილიალი.</li>
          <li>თანამშრომელი შედის <b>/login</b>-ზე თავისი ელფოსტით და პაროლით.</li>
        </ol>
        <div className="grid2">
          <Field label="ელფოსტა"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kitchen@example.com" /></Field>
          <Field label="ფილიალი"><select value={branch} onChange={(e) => setBid(e.target.value)}>{data?.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        </div>
        {note}
        <div><button disabled={busy} onClick={add}>დამატება</button></div>
      </div>
      <div className="card"><div className="tblwrap"><table>
        <thead><tr><th>ელფოსტა</th><th>ფილიალი</th><th></th></tr></thead>
        <tbody>
          {data?.staff.map((s) => <tr key={s.user_id + s.branch_id}><td>{s.email}</td><td>{s.branch_name}</td><td><button className="ghost" disabled={busy} onClick={() => remove(s)}>მოხსნა</button></td></tr>)}
          {data && data.staff.length === 0 ? <tr><td colSpan={3} className="muted">თანამშრომელი ჯერ არ არის</td></tr> : null}
        </tbody>
      </table></div></div>
    </div>
  );
}
