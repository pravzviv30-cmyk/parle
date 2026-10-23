/**
 * How long a learner may pause mid-sentence before the tutor decides they
 * have finished (VOICE-009).
 *
 * Measured with the real Silero VAD and the local turn detector
 * (docs/live-latency-evidence/2026-10-23-pause-endpointing.md): with the
 * framework settings alone, every pause of a second ends the turn unless the
 * audio model happens to call it unfinished, and it called a third of them
 * finished. A beginner who stops to find "un café" got a reply to
 * "Je voudrais".
 *
 * So the floor follows the learner:
 *   - rungs 1-2 (A0-A1) wait 1,200 ms after the last voiced sound, rungs 3-4
 *     keep 400 ms (which the 550 ms VAD silence already covers);
 *   - each cut-off (they start again within 1,500 ms of a committed turn,
 *     before the tutor began answering) adds 400 ms, capped at 2,000 ms;
 *   - "Give me a moment" holds the turn open at 2,500 ms until they finish or
 *     the grace ends.
 *
 * Pure policy plus one small stateful controller that remembers the rung, the
 * hold and the cut-offs, and hands the session a new value only when the
 * value changes. The controller decides nothing about the rescue clock; that
 * stays in convo.ts and tutor.ts.
 */
import type { Rung } from '@luvani/core';

/** The rung floor for A0-A1. Must stay above Silero's 550 ms silence or it does nothing. */
export const BEGINNER_PAUSE_FLOOR_MS = 1_200;
/**
 * Rungs 3-4: the floor Luvani already ran with. In VAD mode minDelay acts as
 * max(VAD silence, minDelay), and Silero's silence is 550 ms, so this turn ends
 * at the VAD's end of speech (measured about 470 ms after the audio stops).
 */
export const FLUENT_PAUSE_FLOOR_MS = 400;
/** Added to the floor for every cut-off this session. */
export const CUT_OFF_STEP_MS = 400;
/** The floor never rises past this, however often they are cut off. */
export const PAUSE_FLOOR_CAP_MS = 2_000;
/** While "Give me a moment" is held. */
export const MOMENT_HOLD_DELAY_MS = 2_500;
/**
 * The longest the session waits when the audio turn detector says the pause
 * is unlikely to be the end. SDK 1.9 applies 2,500 ms by default once a
 * detector is present; pinning it makes that a visible, tested choice.
 */
export const ENDPOINTING_MAX_DELAY_MS = 2_500;
/** A learner starting again this soon after a committed turn was cut off. */
export const CUT_OFF_WINDOW_MS = 1_500;

export interface Endpointing {
  minDelay: number;
  maxDelay: number;
}

export interface ThinkingTimeInput {
  /** The rung the learner is on. Unknown is treated as a beginner. */
  rung?: Rung;
  /** Cut-offs counted so far this session. */
  cutOffs: number;
  /** "Give me a moment" is held. */
  holding: boolean;
}

export function endpointingFor({ rung, cutOffs, holding }: ThinkingTimeInput): Endpointing {
  if (holding) return { minDelay: MOMENT_HOLD_DELAY_MS, maxDelay: ENDPOINTING_MAX_DELAY_MS };
  const base = rung === undefined || rung <= 2 ? BEGINNER_PAUSE_FLOOR_MS : FLUENT_PAUSE_FLOOR_MS;
  const raised = base + Math.max(0, cutOffs) * CUT_OFF_STEP_MS;
  return { minDelay: Math.min(Math.max(base, raised), PAUSE_FLOOR_CAP_MS), maxDelay: ENDPOINTING_MAX_DELAY_MS };
}

/**
 * Counts cut-offs: the learner starting to speak within CUT_OFF_WINDOW_MS of a
 * committed turn, before the tutor has begun its reply. Each committed turn
 * can be counted once.
 */
export class CutOffTracker {
  private committedAt: number | undefined;
  count = 0;

  turnCommitted(now: number): void {
    this.committedAt = now;
  }

  /** The tutor began answering: speaking after this is a new turn, not the rest of the old one. */
  tutorSpeaking(): void {
    this.committedAt = undefined;
  }

  /** Returns true when this start is counted as a cut-off. */
  learnerSpeechStarted(now: number): boolean {
    const at = this.committedAt;
    this.committedAt = undefined;
    if (at === undefined || now - at > CUT_OFF_WINDOW_MS) return false;
    this.count += 1;
    return true;
  }
}

/** What convo.ts and tutor.ts report. Every method is safe to call at any time. */
export interface ThinkingTimeSink {
  rung(rung: Rung): void;
  holding(held: boolean): void;
  turnCommitted(): void;
}

export const NO_THINKING_TIME: ThinkingTimeSink = { rung() {}, holding() {}, turnCommitted() {} };

/**
 * Remembers the inputs and pushes the endpointing to the session only when it
 * changes. `apply` is `session.updateOptions({ turnHandling: { endpointing } })`
 * in agent.ts and a recorder in tests.
 */
export class ThinkingTime implements ThinkingTimeSink {
  private current: Endpointing;
  private rungNow: Rung | undefined;
  private held = false;
  private readonly cutOffs = new CutOffTracker();
  private readonly apply: (endpointing: Endpointing) => void;
  private readonly now: () => number;

  constructor(
    startRung: Rung | undefined,
    apply: (endpointing: Endpointing) => void,
    now: () => number = Date.now,
  ) {
    this.apply = apply;
    this.now = now;
    this.rungNow = startRung;
    this.current = this.compute();
  }

  /** The value the session was built with or last given. */
  get endpointing(): Endpointing {
    return this.current;
  }

  get cutOffCount(): number {
    return this.cutOffs.count;
  }

  rung(rung: Rung): void {
    this.rungNow = rung;
    this.refresh();
  }

  holding(held: boolean): void {
    this.held = held;
    this.refresh();
  }

  turnCommitted(): void {
    this.cutOffs.turnCommitted(this.now());
  }

  tutorSpeaking(): void {
    this.cutOffs.tutorSpeaking();
  }

  learnerSpeechStarted(): void {
    if (this.cutOffs.learnerSpeechStarted(this.now())) this.refresh();
  }

  private compute(): Endpointing {
    return endpointingFor({ rung: this.rungNow, cutOffs: this.cutOffs.count, holding: this.held });
  }

  private refresh(): void {
    const next = this.compute();
    if (next.minDelay === this.current.minDelay && next.maxDelay === this.current.maxDelay) return;
    this.current = next;
    this.apply(next);
  }
}
