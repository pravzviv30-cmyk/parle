/**
 * Whether the first screen waits for the account, and for how long.
 *
 * A learner who signs in on a new phone has months of work in their account and
 * nothing on this device. `ProfileGate` reads the disk, finds no profile, and
 * sends them through onboarding — which writes a brand new beginner profile over
 * the top of an existing one and hands the reconciler a conflict on its very
 * first cycle. The learner is told, in effect, that they have never used this.
 *
 * So on a device with no profile, and only then, the launch waits for one
 * reconcile before it lets `ProfileGate` read. The wait is time boxed, and the
 * time box is the whole point: a learner starting the app on a train with no
 * signal must reach onboarding, not a spinner that never ends. When the box
 * expires the app opens exactly as it does today and the engine keeps trying in
 * the background; the merge that eventually runs favours the evidence heavier
 * side, so nothing they did is spent.
 *
 * Four things are decided here rather than in `App.tsx`, because `App.tsx`
 * imports react-native and this repo has no renderer to test it with. This is
 * the live/thinking.ts arrangement: the rule is a plain function over injected
 * seams, and what stays in the component is the wiring.
 *
 *   1. An ordinary launch pays nothing. A device that already holds a profile
 *      never waits, so first paint is unchanged for everybody who is not on a
 *      new phone.
 *   2. The wait never outlives its budget.
 *   3. Nothing here can throw. A storage failure, a rejected pull and a missing
 *      engine all end at onboarding, which is a way forward.
 *   4. The caller learns which of those happened, so a launch can say so in the
 *      log without guessing. A missing engine is `no-sync`, never the
 *      `unavailable` returned by a failed account pull.
 *
 * The pre-account draft rides on the same answer. It may become this account's
 * profile only on `empty` (the account was read and held nothing) or `no-sync`
 * (there is no account store to overwrite). `has-local`, `adopted`, `timed-out`
 * and `unavailable` never hand it over: none of them proves the account is new,
 * and the draft on this device may be somebody else's answers.
 *
 * It deliberately does NOT decide what to render. `ProfileGate` reads the disk
 * after this resolves and reaches its own conclusion, so adoption is picked up
 * by an ordinary read rather than by this module telling a screen what to show.
 */

import type { SyncRunSummary } from '../sync/engine.ts';

/**
 * How long a fresh device waits for its account.
 *
 * Long enough for one round trip on a slow connection, short enough that a
 * learner with no signal is not left looking at a spinner wondering whether the
 * app is broken. Every millisecond of it is paid only on a device with no
 * profile, which for almost everybody is once.
 */
export const FRESH_DEVICE_BUDGET_MS = 6_000;

export type FreshStartKind =
  /** This device already holds a profile. Nothing was waited for. */
  | 'has-local'
  /** The account had state and a store adopted it. Onboarding is skipped. */
  | 'adopted'
  /** The account reconciled cleanly and had nothing to give. A genuinely new learner. */
  | 'empty'
  /** The budget expired first. Open the app; the engine carries on behind it. */
  | 'timed-out'
  /** No sync engine: mock auth or a build with no account project configured. */
  | 'no-sync'
  /** An account pull was attempted but failed outright. */
  | 'unavailable';

export interface FreshStart {
  readonly kind: FreshStartKind;
  /** True when this launch actually spent time waiting on the network. */
  readonly waited: boolean;
}

/** Unknown or existing account state must never be seeded from a device draft. */
export function mayAdoptPreAccountDraft(start: FreshStart): boolean {
  return start.kind === 'empty' || start.kind === 'no-sync';
}

export interface FreshStartOptions {
  /**
   * Does this device already hold a profile? Pass a read of the profile store.
   * A throw is treated as "yes", so a storage failure never adds a wait.
   */
  readonly hasLocalProfile: () => Promise<boolean>;
  /**
   * One reconcile against the account. Null when there is no engine this launch,
   * which is the mock auth path and any build with no project configured.
   */
  readonly pull: (() => Promise<SyncRunSummary>) | null;
  readonly budgetMs?: number;
  /**
   * Resolves when the time box expires. Injected so a test owns the clock and
   * never has to sleep for real.
   */
  readonly expire?: (ms: number) => Promise<void>;
}

/**
 * Did any store take something from the account?
 *
 * `adopted` is set by the engine only when a merge differed from what this
 * device held and the store's own adopter wrote it. On a device with no profile
 * that means the account had state and this device now has it too.
 */
export function adoptedAnything(summary: SyncRunSummary): boolean {
  return summary.outcomes.some((outcome) => outcome.adopted);
}

const TIMED_OUT = Symbol('fresh-device-timed-out');
const FAILED = Symbol('fresh-device-failed');

/** A promise that settles rather than rejects, so a loser of the race is never unhandled. */
function settled<T, S extends symbol>(work: Promise<T>, onFailure: S): Promise<T | S> {
  return work.then(
    (value) => value,
    () => onFailure,
  );
}

/**
 * Run the fresh device pull, if this launch is one, and answer what happened.
 *
 * Awaited by `SignedInRoot` immediately before `setReady`, after the journal has
 * been recovered and the engine started.
 */
export async function adoptBeforeReady(options: FreshStartOptions): Promise<FreshStart> {
  let hasLocal: boolean;
  try {
    hasLocal = await options.hasLocalProfile();
  } catch {
    // Storage could not answer. Opening straight into the app is the same thing
    // that happens today, and it is better than making an ordinary launch wait
    // on a failure that has nothing to do with the account.
    return { kind: 'has-local', waited: false };
  }
  if (hasLocal) return { kind: 'has-local', waited: false };

  const pull = options.pull;
  if (pull === null) return { kind: 'no-sync', waited: false };

  const budgetMs = options.budgetMs ?? FRESH_DEVICE_BUDGET_MS;
  const expire = options.expire ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let attempt: Promise<SyncRunSummary | typeof FAILED>;
  try {
    attempt = settled(pull(), FAILED);
  } catch {
    // A pull that threw synchronously never became a promise.
    return { kind: 'unavailable', waited: false };
  }

  let box: Promise<typeof TIMED_OUT>;
  try {
    box = settled(
      expire(budgetMs).then(() => TIMED_OUT),
      TIMED_OUT,
    );
  } catch {
    box = Promise.resolve(TIMED_OUT);
  }

  const first = await Promise.race([attempt, box]);
  if (first === TIMED_OUT) return { kind: 'timed-out', waited: true };
  if (first === FAILED) return { kind: 'unavailable', waited: true };
  return { kind: adoptedAnything(first) ? 'adopted' : 'empty', waited: true };
}
