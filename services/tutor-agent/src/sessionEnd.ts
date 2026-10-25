/**
 * The end of a session, said by the tutor rather than by a timer.
 *
 * Without this the server-signed cap is the only ending a session has: the
 * room closes on a learner mid-thought with "your session has reached its time
 * limit". So about a minute before the cap the tutor says, aloud, that time is
 * nearly up, lets the learner have one more exchange, and then says goodbye
 * and closes through the same path a learner's own `leave` takes (recap,
 * settlement, room close).
 *
 * The room never shows minutes left (UI-008). The `wrap-up` frame that goes
 * with the line carries no number; the app echoes the words, never a countdown.
 *
 * Policy lives here and is tested here. The two tutors each expose one small
 * seam (`SessionEndTutor`) and agent.ts feeds this clock the agent and learner
 * states it already listens to. Nothing here extends the cap: the existing hard
 * stop (agent.ts, or the lifecycle's own stop) stays the backstop, and its copy
 * is what a learner still speaking at the last moment sees. Guest scenes are
 * not driven by this; they keep armSceneHardStop.
 */

/** The heads-up is due this long before the cap. */
export const HEADS_UP_LEAD_MS = 60_000;
/**
 * If no warm close has happened by this long before the cap, close now. Room
 * for the close line (bounded by CLOSE_LINE_PLAYOUT_MS), settlement and the
 * post-session enrichment before the hard stop would cut them off.
 */
export const CLOSE_BY_MARGIN_MS = 15_000;
/** Kill switch, default on: `LUVANI_SESSION_HEADS_UP=0` leaves only the hard stop. */
export function headsUpEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.LUVANI_SESSION_HEADS_UP !== '0';
}
/** The longest the close waits on its own line before settling anyway. */
export const CLOSE_LINE_PLAYOUT_MS = 6_000;
/** A session that starts with less than this left gets no heads-up and no close. */
export const MIN_SESSION_FOR_HEADS_UP_MS = 90_000;
/** How often the clock re-checks for a gap once the heads-up is due. */
export const SESSION_END_POLL_MS = 500;

/** Said in English: the learner must understand it whatever their level. */
export const HEADS_UP_LINE = "We're nearly out of time. Let's finish this one together.";
export const CLOSE_LINE = "That's all for today. Thank you, à bientôt !";

/** What the clock reads from a tutor, and the two things it asks of one. */
export interface SessionEndTutor {
  /** Publish `{ t: 'wrap-up' }` and say HEADS_UP_LINE. */
  wrapUp(): void;
  /** Say CLOSE_LINE, then end the session through the tutor's own leave path. */
  closeForTime(): Promise<void>;
  /** Turns the learner has taken, whether busy work is queued, and whether the session is over or closing. */
  sessionEndView(): SessionEndView;
}

/** `held`: a tap-to-send turn is recording, so a silence is not a gap. */
export interface SessionEndView { learnerTurns: number; busy: boolean; over: boolean; voiceless: boolean; held: boolean }

/**
 * Wait for a line to finish playing, but never longer than `ms`. A TTS that
 * never reports playout must not stall settlement behind it.
 */
export async function boundedPlayout(playout: Promise<unknown> | undefined, ms = CLOSE_LINE_PLAYOUT_MS): Promise<void> {
  if (!playout) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([playout, new Promise<void>((resolve) => { timer = setTimeout(resolve, ms); })]);
  } finally {
    clearTimeout(timer);
  }
}

export interface SessionEndTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

type Phase = 'idle' | 'skipped' | 'waiting' | 'due' | 'warned' | 'closing' | 'done';

/**
 * One clock per session. `start()` once the session is live; feed it
 * `agentState` and `learnerSpeaking` from the session's own events.
 */
export class SessionEndClock {
  private phase: Phase = 'idle';
  private agent = 'initializing';
  private speaking = false;
  private turnsAtHeadsUp = 0;
  /** The tutor started speaking after the learner's post-heads-up turn: that is the reply. */
  private replyStarted = false;
  private headsUpTimer: unknown;
  private backstopTimer: unknown;
  private pollTimer: unknown;
  private readonly timers: SessionEndTimers;
  private readonly tutor: SessionEndTutor;
  private readonly remainingMs: () => number;
  private readonly onClose: () => void;

  /** `onClose` runs as the close begins: agent.ts stands its legacy hard stop down there. */
  constructor(tutor: SessionEndTutor, remainingMs: () => number, timers?: SessionEndTimers, onClose: () => void = () => {}) {
    this.onClose = onClose;
    this.tutor = tutor;
    this.remainingMs = remainingMs;
    this.timers = timers ?? {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
  }

  /** Where the clock is. For tests and logs. */
  get state(): Phase {
    return this.phase;
  }

  start(): void {
    if (this.phase !== 'idle') return;
    const left = this.remainingMs();
    // Too short for a minute's warning to mean anything: the hard stop alone.
    if (!(left >= MIN_SESSION_FOR_HEADS_UP_MS)) { this.phase = 'skipped'; return; }
    this.phase = 'waiting';
    this.headsUpTimer = this.timers.setTimeout(() => { this.headsUpTimer = undefined; this.due(); }, left - HEADS_UP_LEAD_MS);
    this.backstopTimer = this.timers.setTimeout(() => { this.backstopTimer = undefined; this.backstop(); }, left - CLOSE_BY_MARGIN_MS);
  }

  agentState(state: string): void {
    this.agent = state;
    if (state === 'speaking' && this.phase === 'warned' && this.tutor.sessionEndView().learnerTurns > this.turnsAtHeadsUp) {
      this.replyStarted = true;
    }
    this.check();
  }

  learnerSpeaking(speaking: boolean): void {
    this.speaking = speaking;
    this.check();
  }

  /** The session ended some other way. Nothing more is said. */
  stop(): void {
    this.phase = this.phase === 'idle' || this.phase === 'skipped' ? this.phase : 'done';
    this.clearTimers();
  }

  private due(): void {
    if (this.phase !== 'waiting') return;
    this.phase = 'due';
    this.check();
  }

  /** Nobody is talking and nothing is queued: a natural place to speak. */
  private gap(view: SessionEndView): boolean {
    return !this.speaking && !view.busy && !view.held && (view.voiceless || this.agent === 'listening');
  }

  private check(): void {
    if (this.phase !== 'due' && this.phase !== 'warned') return;
    const view = this.tutor.sessionEndView();
    if (view.over) { this.stop(); return; }
    if (this.phase === 'due') {
      if (this.gap(view)) {
        this.phase = 'warned';
        this.turnsAtHeadsUp = view.learnerTurns;
        this.replyStarted = false;
        this.tutor.wrapUp();
      }
    } else if (view.learnerTurns > this.turnsAtHeadsUp && this.gap(view) && (view.voiceless || this.replyStarted)) {
      // Their one more exchange has had its reply, spoken in full.
      this.close();
      return;
    }
    this.poll();
  }

  /** States can settle without an event (a queue draining), so look again shortly. */
  private poll(): void {
    if (this.pollTimer !== undefined) return;
    this.pollTimer = this.timers.setTimeout(() => { this.pollTimer = undefined; this.check(); }, SESSION_END_POLL_MS);
  }

  private backstop(): void {
    if (this.phase === 'closing' || this.phase === 'done') return;
    if (this.tutor.sessionEndView().over) { this.stop(); return; }
    // Mid-sentence, or mid-recording, at the last moment: say nothing over
    // them. The hard stop and its own copy are the ending this session gets.
    if (this.speaking || this.tutor.sessionEndView().held) { this.stop(); return; }
    this.close();
  }

  private close(): void {
    this.phase = 'closing';
    this.clearTimers();
    this.onClose();
    void this.tutor.closeForTime().catch(() => {});
  }

  private clearTimers(): void {
    for (const handle of [this.headsUpTimer, this.backstopTimer, this.pollTimer]) {
      if (handle !== undefined) this.timers.clearTimeout(handle);
    }
    this.headsUpTimer = this.backstopTimer = this.pollTimer = undefined;
  }
}
