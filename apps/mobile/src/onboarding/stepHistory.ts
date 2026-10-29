/**
 * Web browser Back inside onboarding (F915, LR-13). Onboarding is drawn
 * outside any NavigationContainer, so the URL stays `/` and browser Back used
 * to leave the app. Each step after the first pushes one history entry with
 * the same URL; a `popstate` then steps back inside the flow. The first step
 * pushes nothing, so browser Back there leaves normally.
 */
export interface StepHistory {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  back(): void;
}

/** The onboarding step a history entry was pushed for, or null for any other entry. */
export function stepOf(state: unknown): string | null {
  if (state === null || typeof state !== 'object') return null;
  const step = (state as { luvaniStep?: unknown }).luvaniStep;
  return typeof step === 'string' ? step : null;
}

/** Called whenever the shown step changes: one entry per step, never a duplicate. */
export function recordStep(history: StepHistory, step: string, first: boolean): void {
  if (first || stepOf(history.state) === step) return;
  const base = history.state !== null && typeof history.state === 'object' ? history.state as object : {};
  history.pushState({ ...base, luvaniStep: step }, '');
}

/**
 * The visible chevron: when the current step owns the top entry, browser Back
 * pops it and `popstate` steps back, so the two stay in step. Otherwise (a
 * resumed step that never pushed) it steps back directly.
 */
export function pressBack(history: StepHistory | null, step: string, back: () => void): void {
  if (history !== null && stepOf(history.state) === step) history.back();
  else back();
}

/** The browser's history on web, or null on native. */
export function webHistory(os: string): StepHistory | null {
  if (os !== 'web' || typeof window === 'undefined' || typeof window.history?.pushState !== 'function') return null;
  return window.history as unknown as StepHistory;
}
