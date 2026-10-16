'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { configured, supabase } from '@/lib/supabase';

const NAV = [
  ['/admin', 'მთავარი'], ['/admin/branches', 'ფილიალები'], ['/admin/zones', 'ზონები და მიტანა'],
  ['/admin/products', 'პროდუქტები და ფასები'], ['/admin/promos', 'პრომო კოდები'], ['/admin/settings', 'პარამეტრები'],
] as const;

/** Signs the user in (redirects to /login) and only lets super admins through. */
export function Guard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState<'load' | 'denied' | 'ok'>('load');
  const [email, setEmail] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) { router.replace('/login'); return; }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!alive) return;
      setEmail(user.email ?? '');
      setState(p?.role === 'super_admin' ? 'ok' : 'denied');
    })();
    return () => { alive = false; };
  }, [router]);

  const out = async () => { await supabase.auth.signOut(); router.replace('/login'); };

  if (!configured) return <div className="main"><div className="err">NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY არ არის შევსებული (.env.local).</div></div>;
  if (state === 'load') return <div className="main muted">იტვირთება…</div>;
  if (state === 'denied') return (
    <div className="main stack"><div className="err">ამ ანგარიშს ადმინისტრატორის უფლება არ აქვს ({email}).</div><div><button className="ghost" onClick={out}>გასვლა</button></div></div>
  );
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">Gochit&apos;s ადმინი</div>
        <nav className="nav">
          {NAV.map(([href, label]) => <Link key={href} href={href} className={path === href ? 'on' : ''}>{label}</Link>)}
        </nav>
        <div style={{ marginTop: 'auto' }} className="stack">
          <div className="small muted" style={{ padding: '0 10px', wordBreak: 'break-all' }}>{email}</div>
          <button className="ghost" onClick={out}>გასვლა</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
