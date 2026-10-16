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
    setBusy(false);
    if (error) setErr('ელფოსტა ან პაროლი არასწორია'); else router.replace('/admin');
  };
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}>
      <form onSubmit={submit} className="card stack" style={{ width: 360, maxWidth: '100%' }}>
        <div><h1 style={{ color: 'var(--yellow)' }}>Gochit&apos;s</h1><p className="muted">ადმინისტრატორის შესვლა</p></div>
        {!configured ? <div className="err">Supabase-ის მისამართი და გასაღები არ არის შევსებული (.env.local).</div> : null}
        <Field label="ელფოსტა"><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="პაროლი"><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        {err ? <div className="err">{err}</div> : null}
        <button disabled={busy || !configured}>{busy ? '…' : 'შესვლა'}</button>
      </form>
    </div>
  );
}
