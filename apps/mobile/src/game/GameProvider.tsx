/**
 * The game layer, for the screens (Come alive, Phase 1, F744, F745).
 *
 * Mounted once in App.tsx, inside the signed-in tree, after the guest hand-off:
 * every store it reads sits behind the account scope. It does three things.
 *
 * 1. Hands the settle pipeline what only the app knows: the billing answer it
 *    last fetched (never a network call inside a settle) and whether the
 *    microphone may record.
 * 2. Runs the existing-learner seed once, then the quiet catch-up on mount,
 *    on every return to the foreground and whenever a screen asks (`refresh`,
 *    for a screen coming into focus). Quiet means nothing takes over the
 *    screen; see `catchUp.ts`.
 * 3. Serves the hooks. Every number a screen shows comes from here, worked out
 *    by `game/view.ts`: a screen never works out a level or an XP total for
 *    itself (README Part 6, held by `game/display.test.ts`).
 *
 * A hook answers null while the facts are loading or could not be read, so a
 * screen draws nothing rather than a 0 it cannot vouch for.
 *
 * The one-time intro sheet is drawn here, only for a learner who already has
 * practice days (review finding 14), with GAME_COPY.intro and one Continue,
 * and never over a live room or an open microphone.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Text } from 'react-native';
import { localDayKey, type GoalProgress, type StreakState, type XpLevel } from '@luvani/core';

import { PillButton, Sheet } from '../components.tsx';
import { fetchBillingStatus } from '../purchases/client.ts';
import { microphonePermission } from '../settings/phoneSettings.ts';
import { liveRoom, micLive, subscribe as subscribeToFocus } from '../sound/audioFocus.ts';
import { activeUserId, scopeGeneration } from '../storage/scope.ts';
import { onDirty } from '../sync/registry.ts';
import { paper, type } from '../theme.ts';
import { catchUpQuietly, seedExistingLearner, type IntroFacts } from './catchUp.ts';
import { GAME_COPY } from './copy.ts';
import { configureGameEnvironment, gameEnvironment, onSettled, readGameFacts } from './settle.ts';
import { gameViewFrom, type BillingFacts, type GameView, type QuestsView, type XpView } from './view.ts';

export interface GameValue {
  /** What is true now, or null while loading or when the facts could not be read. */
  view: GameView | null;
  /** True when the last read failed, so a screen can tell failure from loading. */
  failed: boolean;
  /** Catch up quietly and read the facts again, for a screen that has just come into focus. */
  refresh: () => void;
}

const EMPTY: GameValue = { view: null, failed: false, refresh: () => {} };

const GameContext = createContext<GameValue>(EMPTY);

/**
 * How long the first catch-up waits for the billing answer. Today's quests are
 * dealt once and frozen, so dealing them before the plan is known would leave a
 * paying learner without a conversation quest all day; waiting for ever would
 * leave an offline one with none at all.
 */
const BILLING_WAIT_MS = 4_000;
/** A billing answer younger than this is not asked for again on a return to the foreground. */
const BILLING_FRESH_MS = 5 * 60_000;

export function useGame(): GameValue {
  return useContext(GameContext);
}

export function useStreak(): StreakState | null {
  return useGame().view?.streak ?? null;
}

export function useXp(): XpView | null {
  return useGame().view?.xp ?? null;
}

export function useLevel(): XpLevel | null {
  return useGame().view?.level ?? null;
}

export function useGoal(): GoalProgress | null {
  return useGame().view?.goal ?? null;
}

export function useQuests(): QuestsView | null {
  return useGame().view?.quests ?? null;
}

/** The answer, or `fallback` once `ms` have passed. The work keeps running either way. */
function within<T>(work: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<GameView | null>(null);
  const [failed, setFailed] = useState(false);
  const [intro, setIntro] = useState<IntroFacts | null>(null);
  const billing = useRef<BillingFacts | null>(null);
  const billingReadAt = useRef(0);
  const reading = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const mounted = useRef(true);
  const scope = useRef(scopeGeneration());

  const current = useCallback(() => mounted.current && scope.current === scopeGeneration(), []);

  /** Read the facts again. One read at a time; a request during one reads once more after it. */
  const read = useCallback(() => {
    if (reading.current !== null) {
      again.current = true;
      return;
    }
    const work = (async () => {
      do {
        again.current = false;
        try {
          const env = gameEnvironment();
          const now = env.now();
          const today = localDayKey(now);
          const facts = await readGameFacts(await env.outside(today, now), await env.billing());
          if (!current()) return;
          setView(gameViewFrom(facts, today));
          setFailed(false);
        } catch {
          if (!current()) return;
          setView(null);
          setFailed(true);
        }
      } while (again.current && current());
    })().finally(() => {
      reading.current = null;
    });
    reading.current = work;
  }, [current]);

  /**
   * The last answer this launch stands until a newer one arrives; a failed
   * read leaves it alone rather than forgetting a plan the server confirmed.
   */
  const loadBilling = useCallback(async (force: boolean): Promise<void> => {
    const uid = activeUserId();
    if (uid === null) return;
    if (!force && Date.now() - billingReadAt.current < BILLING_FRESH_MS) return;
    const status = await fetchBillingStatus(uid);
    if (status !== null && current() && activeUserId() === uid) {
      billing.current = { plan: status.plan, lapsed: status.lapsed, secondsRemaining: status.secondsRemaining, canStart: status.canStart };
      billingReadAt.current = Date.now();
    }
  }, [current]);

  /** Seed once, then catch up quietly, then read. Nothing here takes over the screen. */
  const catchUp = useCallback(async (): Promise<void> => {
    try {
      const facts = await seedExistingLearner();
      if (facts !== null && current()) setIntro(facts);
    } catch {
      // Tried again on the next foreground; until then nothing plays.
    }
    try {
      await catchUpQuietly();
    } catch {
      // The next foreground tries again; nothing is shown either way.
    }
    if (current()) read();
  }, [current, read]);

  const refresh = useCallback(() => {
    void catchUp();
  }, [catchUp]);

  useEffect(() => {
    mounted.current = true;
    scope.current = scopeGeneration();
    const restore = configureGameEnvironment({
      billing: () => Promise.resolve(billing.current),
      canRecord: async () => (await microphonePermission()) === 'granted',
    });

    void (async () => {
      await within(loadBilling(true), BILLING_WAIT_MS, undefined);
      if (current()) await catchUp();
    })();

    const foreground = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || !current()) return;
      void within(loadBilling(false), BILLING_WAIT_MS, undefined).then(() => (current() ? catchUp() : undefined));
    });
    const offSettled = onSettled(() => {
      if (current()) read();
    });
    const offDirty = onDirty((namespace) => {
      if ((namespace === 'activity' || namespace === 'game') && current()) read();
    });
    return () => {
      mounted.current = false;
      restore();
      foreground.remove();
      offSettled();
      offDirty();
    };
  }, [catchUp, current, loadBilling, read]);

  // Nothing opens over a live room or an open microphone: the sheet waits for
  // the room to close and the recording to end, then appears.
  const [held, setHeld] = useState(() => micLive() || liveRoom());
  useEffect(() => subscribeToFocus(() => setHeld(micLive() || liveRoom())), []);

  const dismissIntro = useCallback(() => setIntro(null), []);
  const value = useMemo<GameValue>(() => ({ view, failed, refresh }), [view, failed, refresh]);

  return (
    <GameContext.Provider value={value}>
      {children}
      <Sheet
        visible={intro !== null && !held}
        title={GAME_COPY.intro.title}
        onClose={dismissIntro}
        footer={<PillButton label={GAME_COPY.continue} onPress={dismissIntro} />}
      >
        <Text style={[type.body, { color: paper.ink }]}>
          {intro === null ? '' : GAME_COPY.intro.body(intro.current, intro.level)}
        </Text>
      </Sheet>
    </GameContext.Provider>
  );
}
