/**
 * The one celebration host (come alive, motion-sound section 4.1; README Part
 * 5.A and Part 6).
 *
 * Mounted once in `App.tsx`, outside the navigator and above everything it
 * draws, so it covers the first run as well as the app. It listens for moments
 * (`celebrate/events.ts`, which the game pipeline and the wall publish to only
 * after their facts are on disk), lets the queue (`queue.ts`) decide what plays
 * and when, and draws the one card on screen and the one toast.
 *
 * It binds the queue to the world: the synced `game.seen` list
 * (`game/store.ts` hasSeen and markSeen) for an account's moments, this phone's
 * crash-replay queue (`game/gameLocal.ts`), the account scope (a sign-out clears
 * the queue), the app state (nothing starts behind the app) and the one sound
 * and haptic seams. The holds it obeys are taken at their sources: a sheet, an
 * end card, a microphone, a live room and the safety stop.
 *
 * Idle, it draws nothing and takes no touches.
 */

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';

import { dropCelebrations, enqueueCelebrations } from '../game/gameLocal.ts';
import { hasSeen, markSeen } from '../game/store.ts';
import { warmSfx } from '../sound/sfx.ts';
import { onUserScopeReset, scopeGeneration } from '../storage/scope.ts';
import { stopEffects } from './effects.ts';
import { attachCelebrationListener } from './events.ts';
import { createCelebrationQueue, type CelebrationQueue } from './queue.ts';
import { Takeover } from './Takeover.tsx';
import { Toast } from './Toast.tsx';

const active = (state: AppStateStatus | null | undefined): boolean => state !== 'background' && state !== 'inactive';

function createHostQueue(): CelebrationQueue {
  return createCelebrationQueue({
    now: () => Date.now(),
    setTimer: (run, ms) => setTimeout(run, ms),
    clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    generation: scopeGeneration,
    hasSeen,
    markSeen,
    enqueuePending: enqueueCelebrations,
    dropPending: dropCelebrations,
    stopEffects,
  });
}

export function CelebrationHost() {
  const [queue] = useState(createHostQueue);
  const snapshot = useSyncExternalStore(queue.subscribe, queue.snapshot, queue.snapshot);

  useEffect(() => queue.start(), [queue]);
  useEffect(() => attachCelebrationListener(queue.receive), [queue]);
  useEffect(() => onUserScopeReset(() => queue.reset()), [queue]);
  useEffect(() => {
    queue.setActive(active(AppState.currentState));
    const subscription = AppState.addEventListener('change', (state) => queue.setActive(active(state)));
    return () => subscription.remove();
  }, [queue]);
  // The celebration sounds are created ahead of their first moment, so the first one is not late.
  useEffect(() => warmSfx(['streak', 'levelup', 'quest', 'badge', 'complete', 'whoosh', 'save', 'count-tick']), []);

  const { current, paused, toast } = snapshot;
  if (current === null && toast === null) return null;
  return (
    <View style={st.layer}>
      {toast !== null && <Toast key={toast.id} item={toast} onDone={queue.toastDone} />}
      {current !== null && <Takeover key={current.card.id} card={current.card} paused={paused} onFinal={queue.reachedFinal} onContinue={queue.dismiss} />}
    </View>
  );
}

const st = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, pointerEvents: 'box-none' },
});
