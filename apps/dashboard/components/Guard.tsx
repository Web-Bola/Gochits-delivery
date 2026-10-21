'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { configured, supabase } from '@/lib/supabase';

const ICON: Record<string, string> = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6',
  store: 'M3 9l1.5-5h15L21 9M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0M5 12v8h14v-8',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  bag: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0',
  tag: 'M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
};
const NAV_R = [['/restaurant', 'შეკვეთები', 'bag'], ['/restaurant/history', 'ისტორია', 'home'], ['/restaurant/menu', 'მენიუ და მარაგი', 'tag']] as const;
const NAV_A = [
  ['/admin', 'მთავარი', 'home'], ['/admin/merchants', 'ბიზნესები', 'store'], ['/admin/branches', 'ფილიალები', 'store'], ['/admin/zones', 'ზონები და მიტანა', 'pin'],
  ['/admin/products', 'პროდუქტები და ფასები', 'bag'], ['/admin/promos', 'პრომო კოდები', 'tag'], ['/admin/staff', 'თანამშრომლები', 'user'], ['/admin/settings', 'პარამეტრები', 'cog'],
] as const;

/** Signs the user in (redirects to /login) and only lets super admins through. */
export function Guard({ children, area = 'admin' }: { children: ReactNode; area?: 'admin' | 'restaurant' }) {
  const NAV = area === 'admin' ? NAV_A : NAV_R;
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState<'load' | 'denied' | 'ok'>('load');
  const [email, setEmail] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) { router.replace(`/login?next=${encodeURIComponent('/' + area)}`); return; }
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!alive) return;
      setEmail(user.email ?? '');
      setIsAdmin(p?.role === 'super_admin');
      setState(p?.role === 'super_admin' || (area === 'restaurant' && p?.role === 'restaurant_staff') ? 'ok' : 'denied');
    })();
    return () => { alive = false; };
  }, [router, area]);

  const out = async () => { await supabase.auth.signOut({ scope: 'local' }); router.replace('/login'); };

  if (!configured) return <div className="main"><div className="err">NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY არ არის შევსებული (.env.local).</div></div>;
  if (state === 'load') return <div className="main muted">იტვირთება…</div>;
  if (state === 'denied') return (
    <div className="main stack"><div className="err">ამ ანგარიშს ამ გვერდზე შესვლის უფლება არ აქვს ({email}).</div><div><button className="ghost" onClick={out}>გასვლა</button></div></div>
  );
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><img src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/zyro-logo.png`} alt="ZYRO" /></div>
        <nav className="nav">
          {NAV.map(([href, label, ic]) => (
            <Link key={href} href={href} className={path === href ? 'on' : ''}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICON[ic]} /></svg>{label}
            </Link>
          ))}
        </nav>
        <div className="who">
          <div className="small muted" style={{ padding: '0 6px', wordBreak: 'break-all' }}>{email}</div>
          {area !== 'admin' && isAdmin ? <Link href="/admin" className="small" style={{ padding: '0 6px', color: 'var(--brand)' }}>← ადმინ პანელი</Link> : null}
          {area === 'admin' ? <Link href="/restaurant" className="small" style={{ padding: '0 6px', color: 'var(--brand)' }}>რესტორნის პანელი →</Link> : null}
          <button className="ghost" onClick={out}>გასვლა</button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
