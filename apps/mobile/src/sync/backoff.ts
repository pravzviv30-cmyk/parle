/**
 * How long to wait before trying again, and why it is a random number.
 *
 * Full jitter, from AWS's retry write-up: the ceiling doubles per consecutive failure up
 * to a cap, and the actual wait is uniform in `[0, ceiling)`. Plain exponential backoff
 * would be enough for one phone; it is the wrong shape for a fleet. Every device that
 * lost the network in the same tunnel, or during the same provider incident, retries on
 * the same doubling schedule and comes back in a synchronised wave against a server that
 * has just recovered. The jitter is what spreads that wave out.
 *
 * Base 1s, cap 60s. A learner who fixes their connection is never more than a minute
 * from their next attempt, and an app in the background that has been failing for an
 * hour costs sixty requests rather than thousands.
 *
 * Pure, and both sources of non-determinism are injected. A backoff that read
 * `Math.random()` and `Date.now()` directly could only be tested by sleeping, so it
 * would either be tested slowly or — far more likely — not tested at all.
 */

export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_CAP_MS = 60_000;

/**
 * The exponent is clamped rather than left to run.
 *
 * `2 ** 1024` is Infinity, and `Math.min(cap, Infinity)` is the cap, so the arithmetic
 * happens to survive — but a NaN anywhere upstream would propagate into a delay and a
 * `setTimeout(NaN)` fires immediately, turning a backoff into a hot loop. Clamping keeps
 * every intermediate value finite and small.
 */
const MAX_EXPONENT = 30;

/** The longest wait a given attempt could draw: `min(cap, base * 2^attempt)`. */
export function backoffCeiling(attempt: number, baseMs = BACKOFF_BASE_MS, capMs = BACKOFF_CAP_MS): number {
  const exponent = Math.min(Math.max(Math.floor(attempt), 0), MAX_EXPONENT);
  return Math.min(capMs, baseMs * 2 ** exponent);
}

/**
 * The wait for one attempt, given one draw from `[0, 1)`.
 *
 * Pure and separately exported because it is the whole policy: everything else in this
 * file is bookkeeping around it.
 */
export function backoffDelay(
  attempt: number,
  draw: number,
  baseMs = BACKOFF_BASE_MS,
  capMs = BACKOFF_CAP_MS,
): number {
  const ceiling = backoffCeiling(attempt, baseMs, capMs);
  const bounded = Number.isFinite(draw) ? Math.min(Math.max(draw, 0), 1) : 0;
  return Math.floor(bounded * ceiling);
}

export interface BackoffOptions {
  /** Uniform in `[0, 1)`. `Math.random` in the app, a fixed sequence in a test. */
  readonly random: () => number;
  /** Epoch milliseconds. */
  readonly now: () => number;
  readonly baseMs?: number;
  readonly capMs?: number;
}

export interface Backoff {
  /** Consecutive failures so far. */
  attempts(): number;
  /** Record a failure. Returns the wait it drew, in milliseconds. */
  failed(): number;
  /** The clock reading at which a retry is allowed, or null when one is allowed now. */
  readyAt(): number | null;
  /** Is the engine allowed to try again yet? */
  ready(): boolean;
  /** A cycle succeeded. The next failure starts again at the base. */
  succeeded(): void;
  /**
   * The app came back to the foreground, or the network came back.
   *
   * Treated exactly like a success, deliberately. A learner who has just reopened the
   * app is the strongest evidence available that conditions changed, and making them
   * wait out a sixty-second window drawn while their phone was in a lift is the kind of
   * correct-but-useless behaviour that makes sync feel broken.
   */
  resumed(): void;
}

export function createBackoff(options: BackoffOptions): Backoff {
  const { random, now } = options;
  const baseMs = options.baseMs ?? BACKOFF_BASE_MS;
  const capMs = options.capMs ?? BACKOFF_CAP_MS;
  let attempt = 0;
  let waitUntil: number | null = null;

  const clear = (): void => {
    attempt = 0;
    waitUntil = null;
  };

  return {
    attempts: () => attempt,
    failed(): number {
      const delay = backoffDelay(attempt, random(), baseMs, capMs);
      attempt = Math.min(attempt + 1, MAX_EXPONENT);
      waitUntil = now() + delay;
      return delay;
    },
    readyAt: () => waitUntil,
    ready: () => waitUntil === null || now() >= waitUntil,
    succeeded: clear,
    resumed: clear,
  };
}
