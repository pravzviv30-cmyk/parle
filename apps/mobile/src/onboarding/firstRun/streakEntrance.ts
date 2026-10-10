import type { StreakCelebrationView } from './streakCelebrationView.ts';

/** One elapsed-time value drives the entire entrance; there are no independent timers. */
export const STREAK_ENTRANCE_MS = 2120;

export const STREAK_ENTRANCE_TIMELINE = {
  flame: {
    inputRange: [0, 350, 1250, 1410, 1440, 1700, STREAK_ENTRANCE_MS],
    outputRange: [0, 1, 1, 0, 0, 1, 1],
  },
  message: {
    inputRange: [0, 200, 550, 1250, 1410, 1440, 1700, STREAK_ENTRANCE_MS],
    outputRange: [0, 0, 1, 1, 0, 0, 1, 1],
  },
  /** Change layout position only while both flame and message are fully transparent. */
  position: {
    inputRange: [0, 1410, 1440, STREAK_ENTRANCE_MS],
    outputRange: [0, 0, 1, 1],
  },
  support: {
    inputRange: [0, 1700, 1920, STREAK_ENTRANCE_MS],
    outputRange: [0, 0, 1, 1],
  },
};

/** Ordinary daily updates settle sooner; the first day and named milestones have a longer hold. */
export function streakEntranceDuration(variant: StreakCelebrationView['variant']): number {
  return variant === 'daily' ? 1200 : STREAK_ENTRANCE_MS;
}

export interface EntranceReceipts {
  /** A quiet revisit can render the settled page from its first frame. */
  has(eventKey: string): boolean;
  /**
   * Claims a newly persisted qualifying moment once. Call even when motion is
   * reduced: consuming the event then prevents a later setting change from
   * starting a celebration. A null/wrong moment is a quiet page visit.
   */
  claim(eventKey: string, moment: string | null): boolean;
}

/**
 * Keep one instance for the guest journey, outside the page component. A
 * remount, skip or background transition cannot reopen a claimed moment.
 * Across process restarts the page receives no moment from stored progress;
 * only the finish handler can supply a fresh persisted moment.
 */
export function createEntranceReceipts(): EntranceReceipts {
  const claimed = new Set<string>();
  return {
    has(eventKey) { return claimed.has(eventKey); },
    claim(eventKey, moment) {
      if (!eventKey || moment !== eventKey || claimed.has(eventKey)) return false;
      claimed.add(eventKey);
      return true;
    },
  };
}

export type StreakEntrancePhase = 'waiting' | 'introducing' | 'settled';

export interface EntrancePreferences {
  reduced: boolean | null;
  reader: boolean | null;
  active: boolean;
  foreground: boolean;
}

export interface EntranceDecision {
  phase: StreakEntrancePhase;
  /** True exactly once for a fresh visible event; the caller applies its sound/haptic preferences. */
  celebrate: boolean;
  /** True exactly once when the shared elapsed-time animation should start. */
  animate: boolean;
}

/**
 * A single mounted entrance owns one immutable achievement. Accessibility
 * reads may resolve in either order; skip, background and reduced motion are
 * terminal even when those reads are still pending. Receipts survive mounts.
 */
export function createEntranceSession(receipts: EntranceReceipts, eventKey: string | null, moment: string | null) {
  let phase: StreakEntrancePhase = eventKey !== null && eventKey === moment && !receipts.has(eventKey) ? 'waiting' : 'settled';
  const claim = (): boolean => eventKey !== null && receipts.claim(eventKey, moment);
  return {
    get phase(): StreakEntrancePhase { return phase; },
    /** A skip/background/end never waits for an unresolved accessibility read. */
    settle() {
      claim();
      phase = 'settled';
    },
    update({ reduced, reader, active, foreground }: EntrancePreferences): EntranceDecision {
      if (phase === 'settled') return { phase, celebrate: false, animate: false };
      if (!active || !foreground) {
        claim();
        phase = 'settled';
        return { phase, celebrate: false, animate: false };
      }
      if (reduced === true || reader === true) {
        const celebrate = claim();
        phase = 'settled';
        return { phase, celebrate, animate: false };
      }
      if (phase === 'introducing' || reduced === null || reader === null) return { phase, celebrate: false, animate: false };
      const celebrate = claim();
      phase = celebrate ? 'introducing' : 'settled';
      return { phase, celebrate, animate: celebrate };
    },
  };
}
