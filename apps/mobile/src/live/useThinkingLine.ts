/**
 * The room's honest line for a long wait (come alive, core loop 3.4).
 *
 * Null until the tutor has really been thinking for STILL_THINKING_AFTER_MS,
 * measured from the moment `live.thinking` turned true, and null again the
 * moment it turns false. One timer per wait and no ticking: the line appears
 * once and stays until the answer arrives. The words are `thinkingLine`'s.
 */

import { useEffect, useState } from 'react';

import { STILL_THINKING_AFTER_MS, thinkingLine } from './thinking.ts';

export function useThinkingLine(thinking: boolean): string | null {
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    setWaited(0);
    if (!thinking) return undefined;
    const from = Date.now();
    const timer = setTimeout(() => setWaited(Date.now() - from), STILL_THINKING_AFTER_MS);
    return () => clearTimeout(timer);
  }, [thinking]);
  return thinking ? thinkingLine(waited) : null;
}
