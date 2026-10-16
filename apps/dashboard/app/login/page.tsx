'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { configured, supabase } from '@/lib/supabase';
import { Field } from '@/components/bits';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setBusy(false); setErr('ელფოსტა ან პაროლი არასწორია'); return; }
    const { data: u } = await supabase.auth.getUser();
    const { data: p } = await supabase.from('profiles').select('role').eq('id', u.user?.id ?? '').maybeSingle();
    setBusy(false);
    router.replace(p?.role === 'super_admin' ? '/admin' : '/restaurant');
  };
  return (
    <div className="login">
      <div className="band"><img src="/logo.png" alt="Gochit's" /></div>
      <div className="body">
      <form onSubmit={submit} className="card stack">
        <div><h1>შესვლა</h1><p className="muted">გოჩიტ'ს პანელი</p></div>
        {!configured ? <div className="err">Supabase-ის მისამართი და გასაღები არ არის შევსებული (.env.local).</div> : null}
        <Field label="ელფოსტა"><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="პაროლი"><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        {err ? <div className="err">{err}</div> : null}
        <button disabled={busy || !configured}>{busy ? '…' : 'შესვლა'}</button>
      </form>
      </div>
    </div>
  );
}
