/**
 * Whether the live tutor is available, for anyone below the navigator.
 *
 * Lifted out of App.tsx unchanged: the same /health probe with the same 1500 ms
 * abort and the same single quiet retry for a token server that is still
 * booting. `recheck` still runs at the moment the learner starts, so a server
 * that came up after launch is used and one that just died is not.
 */

import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';


interface LiveValue {
  /** True when the token server answered. False means demo, and says so. */
  live: boolean;
  recheck: () => Promise<boolean>;
}

const Ctx = createContext<LiveValue | null>(null);

export function useLive(): LiveValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLive called outside LiveProvider');
  return v;
}

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState(false);

  const recheck = useCallback(async (): Promise<boolean> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    try {
      const r = await fetch(`${TOKEN_SERVER}/health`, { signal: ctrl.signal });
      setLive(r.ok);
      return r.ok;
    } catch {
      setLive(false);
      return false;
    } finally {
      clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    void recheck().then((ok) => {
      // The token server may still be booting when the app opens; one quiet
      // retry covers the common race without polling forever.
      if (!ok && !cancelled) retry = setTimeout(() => void recheck(), 2000);
    });
    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
    };
  }, [recheck]);

  const value = useMemo(() => ({ live, recheck }), [live, recheck]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
