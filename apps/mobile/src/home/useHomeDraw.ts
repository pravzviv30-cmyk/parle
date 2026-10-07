/**
 * What one of Home's cards draws now (F767): its model and its numbers as they
 * were last drawn where the learner could see them.
 *
 * Hand it the card's fresh model, today's day and how to read the model's
 * numbers. The first draw since the card mounted never waits: it starts each
 * number where `home-seen` says (`firstDraw`) when the learner can see Home,
 * and still, where it stands, when they cannot (a sheet over a first launch),
 * so a card is never left as sand. After that it holds the model it last drew
 * until Home's gate opens (`mayDraw`: on top, in front, nothing holding the
 * celebration queue, no takeover) and has stayed open for `DRAW_SETTLE_MS`,
 * then draws the fresh one by `nextDraw`. It remembers the numbers in
 * `home-seen` only once they are drawn. Null until the first draw, so a card
 * mounts its counters once, with the right start.
 *
 * No rule lives here: the rules are `homeDraw.ts` and `homeSeen.ts`, tested
 * without a renderer.
 */

import { useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import type { DayKey } from '@luvani/core';

import { celebrationsHeld, onCelebrationHoldChange } from '../celebrate/queue.ts';
import { onTakeoverOnScreenChange, takeoverOnScreen } from '../celebrate/onScreen.ts';
import { DRAW_SETTLE_MS, drawMoved, firstDraw, mayDraw, nextDraw, type HomeDraw } from './homeDraw.ts';
import { loadHomeSeen, markShown, type ShownValues } from './homeSeen.ts';

export interface HomeDrawn<M> {
  model: M;
  draw: HomeDraw;
}

/** In front: anything but background or inactive, as the celebration host reads it, so an unanswered state never shuts Home. */
const inFront = (state: AppStateStatus | null | undefined): boolean => state !== 'background' && state !== 'inactive';

/** True once the learner can see Home's numbers and that has held for `DRAW_SETTLE_MS`. */
function useDrawGate(): boolean {
  const focused = useIsFocused();
  const [active, setActive] = useState(() => inFront(AppState.currentState));
  const [held, setHeld] = useState(() => celebrationsHeld());
  const [takeover, setTakeover] = useState(() => takeoverOnScreen());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(inFront(state)));
    return () => subscription.remove();
  }, []);
  useEffect(() => onCelebrationHoldChange(() => setHeld(celebrationsHeld())), []);
  useEffect(() => onTakeoverOnScreenChange(() => setTakeover(takeoverOnScreen())), []);

  const open = mayDraw({ focused, active, held, takeover });
  // Open at mount draws at once; reopening waits out the settle.
  const [settled, setSettled] = useState(open);
  useEffect(() => {
    if (!open) {
      setSettled(false);
      return;
    }
    const timer = setTimeout(() => setSettled(true), DRAW_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [open]);
  return open && settled;
}

export function useHomeDraw<M>(today: DayKey | null, model: M | null, counts: (model: M) => ShownValues): HomeDrawn<M> | null {
  const gate = useDrawGate();
  const [drawn, setDrawn] = useState<HomeDrawn<M> | null>(null);
  const last = useRef<HomeDrawn<M> | null>(null);
  // The model by its content, so a new object with the same words and numbers is not news.
  const key = today === null || model === null ? null : `${today}|${JSON.stringify(model)}`;

  useEffect(() => {
    if (key === null || today === null || model === null) return;
    const fresh = counts(model);
    const before = last.current;
    if (before === null) {
      // The first draw never waits, so the card is never left as sand under
      // a sheet. Behind a closed gate it is drawn still, where it stands.
      let live = true;
      void loadHomeSeen().then((seen) => {
        if (!live || last.current !== null) return;
        const next = { model, draw: firstDraw(gate ? seen : null, fresh, today) };
        last.current = next;
        setDrawn(next);
        void markShown(fresh, today, seen);
      });
      return () => {
        live = false;
      };
    }
    if (!gate) return;
    const next = { model, draw: nextDraw(before.draw, fresh, today) };
    last.current = next;
    setDrawn(next);
    if (drawMoved(before.draw, next.draw)) void loadHomeSeen().then((seen) => markShown(fresh, today, seen));
    return undefined;
    // `key` carries `today` and `model`; `counts` reads the model it is handed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, key]);

  return drawn;
}
