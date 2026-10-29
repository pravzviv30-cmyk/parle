/**
 * Web browser Back inside onboarding (F915, LR-13). Onboarding is drawn
 * outside any NavigationContainer, so the URL stays `/` and browser Back used
 * to leave the app.
 *
 * One guard entry, never more: past the first step the browser holds exactly
 * one extra same-URL entry. Browser Back pops it; the guard is pushed again at
 * once (which also drops any Forward entry) and the flow steps back once, or
 * does nothing while busy. Landing on the first step leaves the guard off, so
 * the next Back leaves the app. When onboarding ends, the guard is replaced in
 * place, so no popstate reaches React Navigation and at most one harmless
 * same-URL entry is left behind.
 */
export interface StepHistory {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  replaceState(data: unknown, unused: string): void;
  back(): void;
}

const isGuard = (state: unknown): boolean =>
  state !== null && typeof state === 'object' && (state as { luvaniGuard?: unknown }).luvaniGuard === true;

const base = (state: unknown): object => (state !== null && typeof state === 'object' ? state : {});

export interface PopContext {
  /** The flow is on its first step now. */
  first: boolean;
  /** A step back would be refused (an operation, busy, or a page transition). */
  busy: boolean;
  /** The step back lands on the first step. */
  landsOnFirst: boolean;
  back: () => void;
}

export function historyGuard(history: StepHistory) {
  let ignore = 0;
  const arm = () => { if (!isGuard(history.state)) history.pushState({ ...base(history.state), luvaniGuard: true }, ''); };
  return {
    /** Called when the shown step changes. */
    sync(first: boolean) {
      if (!first) { arm(); return; }
      // Back on the first step by the chevron: take the guard down so one Back leaves.
      if (isGuard(history.state)) { ignore += 1; history.back(); }
    },
    pop(context: PopContext) {
      if (ignore > 0) { ignore -= 1; return; }
      // Forward onto a guard left above the first step, or a pop on the first step: nothing moves.
      if (isGuard(history.state) || context.first) return;
      if (context.busy) { arm(); return; }
      if (!context.landsOnFirst) arm();
      context.back();
    },
    /** Onboarding ends: the guard becomes a plain entry, with no popstate. */
    release() {
      if (!isGuard(history.state)) return;
      const { luvaniGuard: _drop, ...rest } = history.state as { luvaniGuard: boolean };
      history.replaceState(Object.keys(rest).length ? rest : null, '');
    },
  };
}

/** The browser's history on web, or null on native. */
export function webHistory(os: string): StepHistory | null {
  if (os !== 'web' || typeof window === 'undefined' || typeof window.history?.pushState !== 'function') return null;
  return window.history as unknown as StepHistory;
}
