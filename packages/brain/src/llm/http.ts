/**
 * The HTTP shape a brain adapter speaking a REST endpoint uses, and the one
 * retry a rate limit earns.
 *
 * The free tier's most common failure, and the only one worth waiting out.
 *
 * A vendor answers a burst with 429 and a `Retry-After`. Untreated that ends
 * the turn: the learner's sentence goes unanswered and the tutor says a canned
 * line instead. One retry buys most of those turns back.
 *
 * Exactly one, and capped. This is the realtime path — the learner is standing
 * in the silence while we wait, and past a couple of seconds that silence is
 * worse than the fallback. So when the vendor asks for eight seconds we try
 * once at the cap anyway and take whatever we get; a second 429 is a real
 * answer, and it fails exactly as it did before. No general retry policy, no
 * other status, no backoff schedule: the budget cannot absorb one.
 *
 * The budget is one retry per HTTP request, so a call that also needs a repair
 * round-trip could in principle wait twice. That needs a 429 *and* a malformed
 * body in the same turn, and the second wait is what saves it; the worst case
 * is still bounded by twice the cap.
 *
 * One copy on purpose. Two adapters with two caps are two different answers to
 * "how long may a learner stand in silence", and the second one drifts.
 */

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  /** Absent on older fakes; only Retry-After is ever read. */
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

/** Injectable so the rate-limit path can be tested without anyone waiting. */
export type SleepLike = (ms: number) => Promise<void>;

export const RETRY_AFTER_CAP_MS = 2_000;

/** What to wait when the vendor names no usable delay. Short: it is a guess. */
export const RETRY_AFTER_FALLBACK_MS = 500;

/**
 * Retry-After in milliseconds, clamped to the realtime budget.
 *
 * Only the delay-seconds form is understood. The HTTP-date form is legal and
 * neither vendor sends it; reading it as "nothing usable" costs a short pause
 * rather than a wrong one.
 */
export function retryAfterMs(header: string | null | undefined): number {
  const seconds = Number.parseFloat((header ?? '').trim());
  if (!Number.isFinite(seconds) || seconds < 0) return RETRY_AFTER_FALLBACK_MS;
  return Math.min(seconds * 1000, RETRY_AFTER_CAP_MS);
}

export const realSleep: SleepLike = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
