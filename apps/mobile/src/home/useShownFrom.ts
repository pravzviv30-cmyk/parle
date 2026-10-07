/**
 * Where each of Home's numbers starts counting this time it is drawn (F767).
 *
 * Hand it the fresh values a card is about to draw and today's day; it answers
 * with the value each one starts from, by `homeSeen.ts`'s rules, and then
 * remembers the fresh values as shown. Null until that answer is in, so a card
 * mounts its counters once with the right start rather than counting from a
 * guess. A card that is handed new values while it stays on screen counts on
 * from what it already shows; this only decides the first frame.
 *
 * No rule lives here: what starts where is `startsFrom`, tested in
 * `homeSeen.test.ts`.
 */

import { useEffect, useState } from 'react';
import type { DayKey } from '@luvani/core';

import { loadHomeSeen, markShown, startsFrom, type ShownValues } from './homeSeen.ts';

export function useShownFrom(today: DayKey | null, fresh: ShownValues | null): ShownValues | null {
  const [from, setFrom] = useState<ShownValues | null>(null);
  // The values as a key, so a new object with the same numbers is not news.
  const key = today === null || fresh === null ? null : `${today}|${JSON.stringify(fresh)}`;
  useEffect(() => {
    if (key === null || today === null || fresh === null) return;
    let live = true;
    void loadHomeSeen().then((seen) => {
      if (!live) return;
      // Only the first answer sets where the counters start; later values are
      // counted on from what is already drawn.
      setFrom((held) => held ?? startsFrom(seen, fresh, today));
      void markShown(fresh, today, seen);
    });
    return () => {
      live = false;
    };
    // `key` carries `today` and `fresh`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return from;
}
