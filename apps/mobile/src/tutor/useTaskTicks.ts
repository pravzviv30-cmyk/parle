/**
 * The conversation's goal ticks, as the screen holds them (`tutor/taskTicks.ts`
 * decides; this keeps the state and the one timer).
 *
 * Returns the orb's ripple key once the last goal ticks, and whether the
 * scene's card is being held back for that ripple. The hold is
 * `FINAL_TICK_HOLD_MS` and only when movement is not reduced; with it reduced,
 * or with nothing ticked, the card arrives on the turn the scene completes,
 * exactly as before. A safety stop moves nothing. The rows draw their own ticks
 * (`MissionTaskList`).
 */

import { useEffect, useRef, useState } from 'react';
import type { MissionTasks } from '@luvani/core';

import { FINAL_TICK_HOLD_MS, NO_TICKS, ticksAfter, type TickState } from './taskTicks.ts';

export function useTaskTicks(
  items: MissionTasks['items'],
  session: string | null,
  { stopped, reduced }: { stopped: boolean; reduced: boolean },
): { cue: string | null; holdingCard: boolean } {
  const [ticks, setTicks] = useState<TickState>(NO_TICKS);
  const [holdingCard, setHoldingCard] = useState(false);
  const latest = useRef(ticks);
  latest.current = ticks;

  useEffect(() => {
    const step = ticksAfter(latest.current, { session, items, stopped });
    if (step.state !== latest.current) setTicks(step.state);
    if (step.final && !reduced) setHoldingCard(true);
    // `reduced` is read at the tick, not watched: the hold is decided once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, session, stopped]);

  useEffect(() => {
    if (!holdingCard) return undefined;
    const timer = setTimeout(() => setHoldingCard(false), FINAL_TICK_HOLD_MS);
    return () => clearTimeout(timer);
  }, [holdingCard]);

  // Reduce Motion turned on, or a stop, lets the card through at once.
  useEffect(() => {
    if (holdingCard && (reduced || stopped)) setHoldingCard(false);
  }, [holdingCard, reduced, stopped]);

  return { cue: ticks.cue, holdingCard };
}
