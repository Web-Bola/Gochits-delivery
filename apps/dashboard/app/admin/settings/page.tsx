'use client';
import { ok, supabase } from '@/lib/supabase';
import { useAction, useLoad } from '@/components/bits';

export default function Settings() {
  const { data, error, reload } = useLoad(async () => (await supabase.from('app_settings').select('value').eq('key', 'demo_mode').maybeSingle().then(ok<{ value: string } | null>))?.value === 'true');
  const { busy, run, note } = useAction();
  const set = (v: boolean) => run(async () => {
    if (v && !window.confirm('სატესტო რეჟიმი ნამდვილ გადახდას არ ცვლის: ის ბარათით გადახდას „ასიმულირებს“ ფულის გარეშე. ჩავრთო?')) return;
    ok(await supabase.from('app_settings').upsert({ key: 'demo_mode', value: v ? 'true' : 'false' }, { onConflict: 'key' }).select('key'));
    await reload();
  });
  return (
    <div className="stack">
      <div><h1>პარამეტრები</h1></div>
      {error ? <div className="err">{error}</div> : null}
      <div className="card stack">
        <h2>სატესტო რეჟიმი</h2>
        <p className="muted">ჩართულია → აპში „ბარათით გადახდა“ მუშაობს ფულის გარეშე და შეკვეთის სტატუსის გამოცდა შეიძლება. რეალურ გაშვებამდე უნდა იყოს <b>გამორთული</b> (მაშინ ბარათით გადახდა დაიხურება, სანამ გადამხდელი სერვისი არ დაკავშირდება).</p>
        <div className="row">
          <span className={`pill ${data ? 'warn' : 'ok'}`}>{data == null ? '…' : data ? 'ჩართულია' : 'გამორთულია'}</span>
          <button disabled={busy || data == null} className={data ? 'red' : ''} onClick={() => set(!data)}>{data ? 'გამორთვა' : 'ჩართვა'}</button>
        </div>
        {note}
      </div>
    </div>
  );
}
