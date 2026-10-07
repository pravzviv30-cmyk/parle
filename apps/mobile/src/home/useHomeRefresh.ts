import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { localDayKey } from '@luvani/core';
import { DAY_CHECK_MS, dayTurned } from './homeRefresh.ts';
/**
 * Read Home again across midnight and on a return to the foreground, only
 * while it is the tab on top (F768). The timer asks whether the day turned and
 * reads nothing otherwise; `homeRefresh.ts` holds the rule.
 */
export function useHomeRefresh(focused: boolean): number {
  const [revision, setRevision] = useState(0);
  const readFor = useRef(localDayKey(Date.now()));
  useEffect(() => {
    if (!focused) return;
    const refresh = () => {
      readFor.current = localDayKey(Date.now());
      setRevision(n => n + 1);
    };
    const timer = setInterval(() => { if (dayTurned(readFor.current, Date.now())) refresh(); }, DAY_CHECK_MS);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearInterval(timer); foreground.remove(); };
  }, [focused]);
  return revision;
}
