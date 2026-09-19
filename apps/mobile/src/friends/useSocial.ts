import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { readSocial, socialRequest, onSocialChange } from './social.ts';
import type { SocialSnapshot } from './socialModel.ts';

export function useSocial() {
  const [snapshot, setSnapshot] = useState<SocialSnapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const running = useRef(false);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  useFocusEffect(useCallback(() => {
    let live = true;
    let generation = 0;
    const reload = () => {
      const ticket = ++generation;
      void readSocial().then(s => { if (live && ticket === generation) { setSnapshot(s); setError(''); } }).catch(e => { if (live && ticket === generation) { setSnapshot(null); setError(e instanceof Error ? e.message : 'Friends could not connect. Please try again.'); } });
    };
    reload();
    const unsubscribe = onSocialChange(reload);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') reload(); });
    const tick = setInterval(reload, 60000);
    return () => { live = false; clearInterval(tick); unsubscribe(); foreground.remove(); };
  }, [revision]));
  const act = async (action: string, args: Record<string, unknown> = {}): Promise<boolean> => {
    if (running.current) return false;
    running.current = true; setBusy(true); setError('');
    try { await socialRequest(action, args); refresh(); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'That action could not finish. Please try again.'); return false; }
    finally { running.current = false; setBusy(false); }
  };
  return { snapshot, error, busy, act, refresh };
}
