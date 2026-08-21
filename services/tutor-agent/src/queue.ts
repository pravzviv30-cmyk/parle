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

  /** How many pieces of work have been queued. Capture it before you wait. */
  get generation(): number {
    return this.#generation;
  }

  /** True from the moment work is queued until it has finished, good or bad. */
  get busy(): boolean {
    return this.#pending > 0;
  }

  /** Run after everything already queued. */
  run(work: () => Promise<void>): Promise<void> {
    this.#generation += 1;
    this.#pending += 1;
    const settle = () => {
      this.#pending -= 1;
    };
    // Both handlers, so one failed turn cannot stall every turn after it. A
    // thrown model call is a bad turn, not a dead session — and the count comes
    // back down either way, or one failure would silence every later rescue.
    const next = this.#tail.then(work, work);
    this.#tail = next.then(settle, settle);
    return next;
  }

  /** Run only if nothing has been queued since `generation` was captured. */
  runIfCurrent(generation: number, work: () => Promise<void>): Promise<void> {
    if (generation !== this.#generation) return Promise.resolve();
    return this.run(work);
  }

  /** Settle when everything queued so far has finished. For tests. */
  idle(): Promise<void> {
    return this.#tail;
  }
}
