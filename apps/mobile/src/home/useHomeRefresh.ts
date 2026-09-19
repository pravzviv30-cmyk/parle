import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
/** Refresh daily content across midnight and foregrounding, only while visible. */
export function useHomeRefresh(focused: boolean): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!focused) return;
    const refresh = () => setRevision(n => n + 1);
    const timer = setInterval(refresh, 60000);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); foreground.remove(); };
  }, [focused]);
  return revision;
}
