/**
 * The app's one error boundary, and what it may say about what it caught (F794).
 *
 * Without it, one throw while React renders or commits, in any screen, effect
 * or cleanup, unmounts the whole tree. A development build then shows a white
 * screen behind LogBox, and React Native reports the throw as fatal, which in
 * a release build closes the app. F792 and F693 each did this from one native
 * call in a cleanup. Caught here, the same throw is reported as non-fatal
 * (react-native's ErrorHandlers.onCaughtError) and the learner is shown a way
 * back instead of nothing.
 *
 * The way back mounts everything beneath the boundary again, which recovers
 * the way a relaunch does: the session, the onboarding draft and every store
 * are on the device, and a fresh tree reads them back. Navigation starts over,
 * as it does after a relaunch.
 *
 * A boundary sees render and commit only. A throw in a tap handler, a timer or
 * a promise goes past it to React Native's own handlers, as it always has. And
 * React retries a render that throws once, synchronously, before it gives up
 * to a boundary, so a render throw that does not recur never reaches this.
 *
 * Where it sits is App.tsx's decision and errorBoundary.test.ts holds it there.
 * It is the door's own root: every screen is inside it, while Gate and the auth
 * provider stay above it, so what the launch must remember outlives a Try
 * again. It is inside the safe-area provider and never around the launch, so a
 * catch can neither blank the launch nor take it away before it has released
 * the native one.
 *
 * Built with createElement and no react-native import, so node runs the real
 * class in the test. The screen it draws instead is handed in by App.tsx.
 */

import { Component, Fragment, createElement, type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────── what is reported

/**
 * What the boundary may say about a caught throw: its class, its code, and how
 * many times the learner had already tried again. Never the message.
 *
 * The message is the one part of an error that can carry a learner's words,
 * in an error built around a phrase or a parse error quoting what it read. A
 * class and a code are names a programmer chose. observability-engineer's rule
 * allows error class, failure mode, timing and counts, and this is two of
 * those and a count. Adding a field is adding something the app may say about
 * a learner, and the test pins the list.
 */
export interface CaughtError {
  /** The error's class, such as `TypeError`, or `?` when it has no plain one. */
  readonly name: string;
  /** A native module's code, when the error carries one as a plain word. */
  readonly code: string | null;
  /** How many times Try again had been pressed before this catch. */
  readonly retries: number;
}

/** Every key a `CaughtError` has, in print order. The test asserts this is exact. */
export const CAUGHT_ERROR_FIELDS = ['name', 'code', 'retries'] as const;

/** What a name becomes when it is not a plain word. Never a partial scrub. */
export const UNKNOWN_NAME = '?';

/** Letters, digits, dot, dash, underscore: sync/diagnostics.ts's rule, with room for a long code. */
const PLAIN_WORD = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function plainWord(value: unknown): string | null {
  return typeof value === 'string' && PLAIN_WORD.test(value) ? value : null;
}

/**
 * Reduce whatever was thrown to a `CaughtError`.
 *
 * Anything can be thrown, so nothing here may throw back: a getter that throws
 * or a revoked proxy reads as a throw with no plain name.
 */
export function caughtError(thrown: unknown, retries: number): CaughtError {
  const count = Number.isFinite(retries) ? Math.max(0, Math.trunc(retries)) : 0;
  try {
    if (typeof thrown !== 'object' || thrown === null) return { name: UNKNOWN_NAME, code: null, retries: count };
    const { name, code } = thrown as { name?: unknown; code?: unknown };
    return { name: plainWord(name) ?? UNKNOWN_NAME, code: plainWord(code), retries: count };
  } catch {
    return { name: UNKNOWN_NAME, code: null, retries: count };
  }
}

/**
 * The stable alarm: one line for each throw the boundary catches, while a
 * learner is looking at the error screen. A cleanup that throws in the tree a
 * catch has just removed is caught too, so one screen can carry two lines.
 * Somebody greps for it, so like `SYNC_NOT_CONVERGED` it does not get renamed.
 */
export const APP_ERROR_ALARM = '[luvani] APP_ERROR_CAUGHT';

/** One line, alarm first. An absent code is left out rather than printed. */
export function formatCaughtError(caught: CaughtError): string {
  const parts = [`name=${caught.name}`];
  if (caught.code !== null) parts.push(`code=${caught.code}`);
  parts.push(`retries=${caught.retries}`);
  return `${APP_ERROR_ALARM} ${parts.join(' ')}`;
}

/**
 * Where a catch goes today: one line on the console, beside the app's other
 * alarms. There is no error reporting to hand it to yet. When
 * observability-engineer cuts that seam, this function is what moves into it.
 */
export function logCaughtError(caught: CaughtError): void {
  console.error(formatCaughtError(caught));
}

// ───────────────────────────────────────────────────────────────── the boundary

export type BoundaryState = {
  /** A throw below has been caught and the way back is on screen. */
  readonly caught: boolean;
  /** How many times the tree below has been mounted again. It is that tree's key. */
  readonly generation: number;
};

export const FIRST_MOUNT: BoundaryState = { caught: false, generation: 0 };

/** Try again: the way back goes, and everything below mounts afresh under a new key. */
export function triedAgain(state: BoundaryState): BoundaryState {
  return { caught: false, generation: state.generation + 1 };
}

type Props = {
  readonly children?: ReactNode;
  /**
   * The screen drawn instead of the tree, handed the way back and nothing
   * else. It is never given the error, so no raw error can reach a learner.
   */
  readonly fallback: (tryAgain: () => void) => ReactNode;
  /** Where a catch is reported. The console alarm unless a test hands another. */
  readonly report?: (caught: CaughtError) => void;
};

export class AppErrorBoundary extends Component<Props, BoundaryState> {
  state: BoundaryState = FIRST_MOUNT;

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { caught: true };
  }

  componentDidCatch(thrown: unknown): void {
    try {
      (this.props.report ?? logCaughtError)(caughtError(thrown, this.state.generation));
    } catch {
      // A report that throws would take down the screen that is the way back.
    }
  }

  tryAgain = (): void => {
    this.setState(triedAgain);
  };

  render(): ReactNode {
    if (this.state.caught) return this.props.fallback(this.tryAgain);
    return createElement(Fragment, { key: this.state.generation }, this.props.children);
  }
}
