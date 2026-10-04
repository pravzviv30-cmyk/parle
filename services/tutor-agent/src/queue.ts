/**
 * One thing at a time, and a way to tell that the moment has passed.
 *
 * Two events can reach a live session at once, and they are not independent: the
 * rescue timer fires at four seconds, and the learner starts talking at four
 * seconds and a bit. Nothing was serialising the state between them, so both
 * could apply — silence dropping a rung, speech grading against a turn that had
 * already moved, two replies generated, one of the two turns lost.
 *
 * The queue is the smaller half of the fix: it makes the mutations happen one
 * after another rather than interleaved. The generation counter is the other
 * half. A rescue captures the count when it is armed, and if anything else has
 * been queued by the time the timer fires, it drops itself — because a learner
 * who has started speaking does not need to be rescued from silence.
 *
 * The generation alone was not enough, and the gap only shows on a slow brain.
 * The count goes up when work is ENQUEUED, so a clock armed after the learner's
 * turn was queued captures a number that already includes it: the rescue passes
 * runIfCurrent and queues itself behind a turn that is still being written. Sub-
 * second turns hid it — nothing was ever still in flight four seconds later. So
 * the queue also says whether it is in the middle of something, and a rescue
 * stands down while it is, because a learner waiting on the tutor is not stuck.
 */
export class TurnQueue {
  #tail: Promise<void> = Promise.resolve();
  #generation = 0;
  #pending = 0;
  #epoch = 0;
  #cancelled = new AbortController();
  readonly maxPending: number;

  constructor(options: { maxPending?: number } = {}) {
    const maximum = options.maxPending ?? 4;
    if (!Number.isInteger(maximum) || maximum < 1 || maximum > 32) throw new RangeError('Invalid queue capacity');
    this.maxPending = maximum;
  }

  get pending(): number { return this.#pending; }
  get full(): boolean { return this.#pending >= this.maxPending; }

  /** Invalidate waiting work immediately. The caller aborts any in-flight provider call. */
  clearPending(): void {
    this.#cancelled.abort();
    this.#cancelled = new AbortController();
    this.#epoch += 1;
    this.#generation += 1;
  }

  /** How many pieces of work have been queued. Capture it before you wait. */
  get generation(): number {
    return this.#generation;
  }

  /** True from the moment work is queued until it has finished, good or bad. */
  get busy(): boolean {
    return this.#pending > 0;
  }

  /** Run after everything already queued. */
  run(work: (signal: AbortSignal) => Promise<void>): Promise<void> {
    // An overload is refused without creating another promise-chain node or
    // throwing into a fire-and-forget SDK callback. Input routes report it.
    if (this.full) return Promise.resolve();
    const epoch = this.#epoch;
    const signal = this.#cancelled.signal;
    this.#generation += 1;
    this.#pending += 1;
    const settle = () => {
      this.#pending -= 1;
    };
    // Both handlers, so one failed turn cannot stall every turn after it. A
    // thrown model call is a bad turn, not a dead session — and the count comes
    // back down either way, or one failure would silence every later rescue.
    const accepted = () => epoch === this.#epoch ? work(signal) : Promise.resolve();
    const next = this.#tail.then(accepted, accepted);
    this.#tail = next.then(settle, settle);
    return next;
  }

  /** Run only if nothing has been queued since `generation` was captured. */
  runIfCurrent(generation: number, work: (signal: AbortSignal) => Promise<void>): Promise<void> {
    if (generation !== this.#generation) return Promise.resolve();
    return this.run(work);
  }

  /** Settle when everything queued so far has finished. For tests. */
  idle(): Promise<void> {
    return this.#tail;
  }
}

/** Per-job admission for work-generating commands; presence uses a separate bucket. */
export class CommandBudget {
  // A complete twelve-turn quiet lesson may be answered quickly. The pending
  // bound separately limits simultaneous provider work, including this burst.
  #tokens = 16;
  #presence = 20;
  #used = 0;
  #last: number;
  readonly #now: () => number;

  constructor(now: () => number = () => performance.now()) { this.#now = now; this.#last = now(); }

  allow(tag: string): boolean {
    // Leaving and opting into quiet mode must remain reachable under overload.
    if (tag === 'leave' || tag === 'mode') return true;
    const at = this.#now();
    const elapsed = Math.max(0, at - this.#last);
    this.#last = at;
    this.#tokens = Math.min(16, this.#tokens + elapsed / 2_000);
    this.#presence = Math.min(20, this.#presence + elapsed / 100);
    if (tag === 'ready' || tag === 'typing' || tag === 'moment') {
      if (this.#presence < 1) return false;
      this.#presence -= 1;
      return true;
    }
    // The burst/rate bound is not a session spend bound by itself. Also limit
    // total accepted commands in this job, independent of wall-clock refill.
    if (this.#tokens < 1 || this.#used >= 180) return false;
    this.#tokens -= 1;
    this.#used += 1;
    return true;
  }
}

/** Replay controls return promptly; their media slot remains held only until playout/cancel/deadline. */
export async function replayPlayout(playout: Promise<void> | undefined, signal: AbortSignal): Promise<void> {
  if (!playout || signal.aborted) return;
  let release: () => void = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const cancelled = new Promise<void>(resolve => {
      release = resolve;
      signal.addEventListener('abort', release, { once: true });
      timer = setTimeout(release, 30_000);
    });
    await Promise.race([playout, cancelled]);
  } finally {
    if (timer) clearTimeout(timer);
    signal.removeEventListener('abort', release);
  }
}
