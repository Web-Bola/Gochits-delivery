'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="f">{label}{children}</label>;
}

/** Loads data once and again on reload(). Errors are shown, never swallowed. */
export function useLoad<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const reload = useCallback(async () => {
    setError('');
    try { setData(await fn()); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, [reload]);
  return { data, error, reload };
}

/** Runs an async action with busy / error / "saved" feedback. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const run = async (fn: () => Promise<void>, msg = 'შენახულია ✓') => {
    setBusy(true); setError(''); setDone('');
    try { await fn(); setDone(msg); setTimeout(() => setDone(''), 2500); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };
  const note = (<>{error ? <div className="err">{error}</div> : null}{done ? <div className="okmsg">{done}</div> : null}</>);
  return { busy, run, note };
}
