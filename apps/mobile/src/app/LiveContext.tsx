/**
 * Whether the live tutor is available, for anyone below the navigator.
 *
 * Lifted out of App.tsx unchanged: the same /health probe with the same 1500 ms
 * abort and the same single quiet retry for a token server that is still
 * booting. `recheck` still runs at the moment the learner starts, so a server
 * that came up after launch is used and one that just died is not.
 *
 * F924 (2026-10-29): it also asks again when the connection may have come
 * back: the browser's `online` event, the app returning to the foreground,
 * and every 30 s while not live (stopped once live), through `watchLive`.
 */

import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { watchLive } from './liveWatch.ts';

/** The slow re-probe while offline: one cheap GET every half minute, none once live. */
const OFFLINE_REPROBE_MS = 30_000;


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
  const liveNow = useRef(false);

  const recheck = useCallback(async (): Promise<boolean> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 1500);
    try {
      const r = await fetch(`${TOKEN_SERVER}/health`, { signal: ctrl.signal });
      liveNow.current = r.ok;
      setLive(r.ok);
      return r.ok;
    } catch {
      liveNow.current = false;
      setLive(false);
      return false;
    } finally {
      clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;
    // The token server may still be booting when the app opens; one quiet
    // retry at 2 s covers the common race, then the watcher's slow repeat.
    const stop = watchLive({
      probe: async () => {
        const ok = await recheck();
        if (!ok && !cancelled && retry === null) retry = setTimeout(() => void recheck(), 2000);
        return ok;
      },
      isLive: () => liveNow.current,
      onOnline: (fn) => {
        const target = globalThis as { addEventListener?: (name: string, fn: () => void) => void; removeEventListener?: (name: string, fn: () => void) => void };
        target.addEventListener?.('online', fn);
        return () => target.removeEventListener?.('online', fn);
      },
      onForeground: (fn) => {
        const sub = AppState.addEventListener('change', (state) => { if (state === 'active') fn(); });
        return () => sub.remove();
      },
      every: OFFLINE_REPROBE_MS,
      setRepeat: (fn, ms) => setInterval(fn, ms),
      clearRepeat: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
    });
    return () => {
      cancelled = true;
      stop();
      if (retry) clearTimeout(retry);
    };
  }, [recheck]);

  const value = useMemo(() => ({ live, recheck }), [live, recheck]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
