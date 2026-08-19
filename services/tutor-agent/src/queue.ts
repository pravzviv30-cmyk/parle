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
 */
export class TurnQueue {
  #tail: Promise<void> = Promise.resolve();
  #generation = 0;

  /** How many pieces of work have been queued. Capture it before you wait. */
  get generation(): number {
    return this.#generation;
  }

  /** Run after everything already queued. */
  run(work: () => Promise<void>): Promise<void> {
    this.#generation += 1;
    // Both handlers, so one failed turn cannot stall every turn after it. A
    // thrown model call is a bad turn, not a dead session.
    const next = this.#tail.then(work, work);
    this.#tail = next.catch(() => {});
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
