import { useEffect, useState } from 'react';
import { DAY_CHECK_MS } from './homeRefresh.ts';
import { skyClockMoved } from './skyView.ts';

/**
 * Today's one clock for the sky and the greeting (fix round 3): one `now` for
 * both, re-checked every `DAY_CHECK_MS` while Today is on top and at focus,
 * moving only when the sky's window or the greeting's word would change
 * (`skyClockMoved`), so the page re-draws at 12:00, 18:00, 22:00 and 05:00.
 */
export function useSkyClock(focused: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!focused) return;
    const check = () => setNow((drawn) => { const at = Date.now(); return skyClockMoved(drawn, at) ? at : drawn; });
    check();
    const timer = setInterval(check, DAY_CHECK_MS);
    return () => clearInterval(timer);
  }, [focused]);
  return now;
}
