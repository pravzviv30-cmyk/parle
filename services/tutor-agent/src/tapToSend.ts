/**
 * Tap-to-send: the learner's turn ends when they tap Send, never on a pause.
 *
 * Even with VOICE-010's floors, a learner who stops for three seconds to find
 * a word is answered on half a sentence. With this on, the microphone stays
 * open and the turn is held until Send, or until the recording cap, so a long
 * think costs nothing.
 *
 * The mechanism is the SDK's own manual turn detection (SDK 1.9):
 * `updateOptions({ turnHandling: { turnDetection: 'manual' } })` stops the
 * session ending turns itself, and `commitUserTurn()` ends one. What that costs:
 *   - Barge-in by voice is off while it is on. The activity sets
 *     isDefaultInterruptionByAudioActivityEnabled false for 'manual', so the
 *     learner cannot talk over the tutor; their words wait and land in the
 *     held turn instead.
 *   - Restoring is not "put the old value back". The session's turnDetection
 *     holds the default audio detector INSTANCE, and the recogniser keeps that
 *     instance whatever mode it is in. Handing the instance back through
 *     updateOptions sets the recogniser's mode to an object, which turns VAD
 *     end-of-speech detection off: no pause would ever end a turn again.
 *     So a saved string ('vad') is restored as itself, and anything else is
 *     restored as `null` (mode unset), which is exactly what the session was
 *     built with. tapToSendSdk.test.ts holds this.
 *
 * Rescue: while a held turn is open the tutors' armRescue stays dark
 * (setHeldTurn), because a pause while recording is thinking, not being stuck.
 * Before the learner says anything the ordinary stuck clock runs.
 */
import type { ServerMessage } from '@luvani/core';
import { safeError } from './safeError.ts';

/** A held turn sends itself after this long. */
export const TAP_SEND_CAP_MS = 60_000;
/** The app is told the turn is closing this long after it opened. */
export const TAP_SEND_WARN_MS = 50_000;

/** Kill switch, default on: `LUVANI_TAP_TO_SEND=0` ignores the switch and Send, so turns stay automatic. */
export function tapToSendEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.LUVANI_TAP_TO_SEND !== '0';
}

/** The string modes the SDK takes back as themselves. */
type SavedMode = 'manual' | 'vad' | 'stt' | 'realtime_llm';

/** The parts of voice.AgentSession this needs. */
export interface TapSession {
  turnDetection?: unknown;
  updateOptions(options: { turnHandling: { turnDetection: SavedMode | null } }): void;
  commitUserTurn(): void;
}

/** The tutor seam: rescue stays dark while a turn is held. */
export interface HeldTurnTutor {
  setHeldTurn(open: boolean): void;
}

export interface TapTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export class TapToSend {
  private enabled = false;
  /** Typed right now: there is no microphone to hold open, so `on` is refused. */
  private quiet: boolean;
  private held = false;
  /**
   * The session has started. Before that the SDK has no activity, and
   * updateOptions would overwrite the session's default audio detector with
   * 'manual' before the activity is built from it, leaving the session on
   * VAD alone for life. So a switch that arrives early is remembered and
   * applied once by `markLive()`.
   */
  private live = false;
  private wanted = false;
  /** The agent's last state. A commit while it speaks an uninterruptible line is dropped by the SDK. */
  private agent = 'initializing';
  /** Send (or the cap) landed while the tutor was speaking; commit when it stops. */
  private commitDeferred = false;
  private saved: unknown;
  private warnTimer: unknown;
  private capTimer: unknown;
  private readonly timers: TapTimers;
  private readonly session: () => TapSession;
  private readonly tutor: HeldTurnTutor;
  private readonly publish: (message: ServerMessage) => unknown;

  constructor(session: () => TapSession, tutor: HeldTurnTutor, publish: (message: ServerMessage) => unknown, timers?: TapTimers, options: { voiceless?: boolean } = {}) {
    this.quiet = options.voiceless ?? false;
    this.session = session;
    this.tutor = tutor;
    this.publish = publish;
    this.timers = timers ?? {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
    };
  }

  get on(): boolean { return this.enabled; }
  get open(): boolean { return this.held; }

  /** The learner's switch. Acts only on a change. */
  setOn(on: boolean): void {
    if (!this.live) { this.wanted = on && !this.quiet; return; }
    if (on === this.enabled || (on && this.quiet)) return;
    const session = this.session();
    if (on) {
      this.saved = session.turnDetection;
      this.enabled = true;
      session.updateOptions({ turnHandling: { turnDetection: 'manual' } });
      return;
    }
    // Switched off mid-recording: what they said is theirs, so it is sent
    // rather than thrown away. Committed while still manual, then restored.
    if (this.held) this.commit();
    this.enabled = false;
    const restore = typeof this.saved === 'string' ? this.saved as SavedMode : null;
    session.updateOptions({ turnHandling: { turnDetection: restore } });
  }

  /**
   * The learner's `mode` switch, peeked at by agent.ts (the tutor still gets
   * the frame). Going typed turns tap-to-send off, sending any held turn, and
   * refuses `on` until they come back to voice; the app re-sends its switch then.
   */
  setVoiceless(voiceless: boolean): void {
    if (voiceless) this.setOn(false);
    this.quiet = voiceless;
  }

  /** Called once `session.start()` has resolved. Applies a switch that came early. */
  markLive(): void {
    if (this.live) return;
    this.live = true;
    if (this.wanted) this.setOn(true);
  }

  /** From AgentStateChanged. A deferred commit goes out once the tutor stops speaking. */
  agentState(state: string): void {
    this.agent = state;
    if (state !== 'speaking' && this.commitDeferred) { this.commitDeferred = false; this.commitNow(); }
  }

  /** From UserStateChanged. The first speech while on opens the held turn. */
  learnerSpeaking(speaking: boolean): void {
    if (!speaking || !this.enabled || this.held) return;
    this.held = true;
    this.tutor.setHeldTurn(true);
    void this.publish({ t: 'held-turn', state: 'open' });
    this.warnTimer = this.timers.setTimeout(() => {
      this.warnTimer = undefined;
      if (this.held) void this.publish({ t: 'held-turn', state: 'closing' });
    }, TAP_SEND_WARN_MS);
    this.capTimer = this.timers.setTimeout(() => { this.capTimer = undefined; this.commit(); }, TAP_SEND_CAP_MS);
  }

  /** The learner tapped Send. Ignored while off or with nothing held: no empty commit. */
  send(): void {
    if (!this.enabled || !this.held || this.commitDeferred) return;
    this.commit();
  }

  /** The session is over. Timers go; nothing is committed. */
  stop(): void {
    this.commitDeferred = false;
    this.clearTimers();
    if (this.held) { this.held = false; this.tutor.setHeldTurn(false); }
  }

  private commit(): void {
    if (!this.held || this.commitDeferred) return;
    this.clearTimers();
    // The SDK drops a commit while an uninterruptible line plays, clearing
    // the transcript with it. Still held (rescue stays dark) until it lands.
    if (this.agent === 'speaking') { this.commitDeferred = true; return; }
    this.commitNow();
  }

  private commitNow(): void {
    if (!this.held) return;
    this.held = false;
    // Rescue comes back before the commit lands, so the turn the commit
    // produces is the thing that clears it, as with any other turn.
    this.tutor.setHeldTurn(false);
    try {
      this.session().commitUserTurn();
    } catch (error) {
      console.error('[luvani] a held turn could not be committed:', safeError(error));
    }
    void this.publish({ t: 'held-turn', state: 'sent' });
  }

  private clearTimers(): void {
    if (this.warnTimer !== undefined) this.timers.clearTimeout(this.warnTimer);
    if (this.capTimer !== undefined) this.timers.clearTimeout(this.capTimer);
    this.warnTimer = this.capTimer = undefined;
  }
}
