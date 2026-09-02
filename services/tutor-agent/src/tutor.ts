/**
 * The scripted tutor: one lesson, one ladder, one learner.
 *
 * Lives apart from agent.ts on purpose. That module is the worker entry point —
 * importing it runs preflight, probes every vendor and calls cli.runApp at module
 * scope, so nothing that imports it can be unit tested. This class holds all the
 * behaviour worth testing (what a turn does to the ladder, when the rescue fires,
 * what happens to a transcript that came back empty) and imports no CLI and no
 * keys, so a test can build one with a stubbed session and drive it directly.
 *
 * The pedagogy itself is @luvani/core's, unmodified — the same ladder, lesson and
 * grading the app runs. Two copies of "four seconds of silence is being stuck,
 * not thinking" drift apart within a month.
 */

import { voice, llm, type stt } from '@livekit/agents';
import type { AudioFrame } from '@livekit/rtc-node';
import { ReadableStream } from 'node:stream/web';
import {
  createSession,
  currentPrompt,
  submitTurn,
  summarise,
  decodeClientMessage,
  toLearnerInput,
  STUCK_SILENCE_MS,
  type Lesson,
  type Rung,
  type ServerMessage,
  type SessionState,
  type TutorPersona,
} from '@luvani/core';
// One text-mode window for both session shapes, imported rather than restated:
// two ideas of how long a typed answer may take drift apart within a month, and
// the learner would feel the difference as two different tutors. The import
// goes both ways between these files (convo.ts already takes the replay ledger
// from here) and neither module reads the other while it is being evaluated.
import { TEXT_SILENCE_MS } from './convo.ts';
import { buildPrompt } from './prompt.ts';
import { scoreUtterance } from './speechace.ts';
import { reportUsage } from './usage.ts';
import { TurnQueue } from './queue.ts';
import { UtteranceTap, audioScoringEnabled, observeEvents, observeFrames } from './utterance.ts';
import { recordSafetyDecision, safetyDecision } from './safety.ts';

/**
 * Anything that can carry a message back to the app.
 *
 * The return value is optional and almost every caller ignores it. One does
 * not: a stop closes the room straight after the message, and closing it before
 * a reliable data frame has flushed would take the crisis line with it. So a
 * publisher that knows when its frame has landed may say so, and
 * `closeAfterStop` is the only place that waits.
 */
type Publisher = (message: ServerMessage) => void | Promise<void>;

/**
 * The half of the framework's SpeechHandle this file uses.
 *
 * Structural rather than imported: `voice` does not re-export SpeechHandle, and
 * in text mode and in tests there is no handle at all.
 */
type SpokenLine = { waitForPlayout: () => Promise<void> } | undefined;

/**
 * The session id agent.ts has not written yet.
 *
 * Direct unit tests build tutors with no signed room, and `reportUsage` already
 * refuses to debit against this value. Nothing below treats it as a session
 * either, so a test tutor can never poison the replay ledger.
 */
export const UNSIGNED_SESSION_ID = '00000000-0000-4000-8000-000000000000';

/** What the learner is told when a spent credential re-opens their room. */
export const REPLAYED_SESSION_MESSAGE = 'That session has already finished. Start a new one whenever you are ready.';

/** How many reported session ids a worker keeps before dropping the oldest. */
const REPORTED_SESSIONS_KEPT = 10_000;

/**
 * Sessions this worker has already reported to the token server.
 *
 * A join credential is a bearer token with minutes of life still on it once the
 * session it opened has ended, and LiveKit re-creates a closed room for whoever
 * presents one — measured live, 279s of ttl left on a room whose session was
 * already reported (F77). The empty room by itself costs nothing. What costs
 * money is the tutor dispatched into it, so the tutor is what refuses.
 *
 * A session id is signed into the credential and reported exactly once, which
 * makes "already reported" the honest test for a replay, and it reuses the
 * ledger seam rather than inventing a second idea of when a session is over.
 *
 * Worker-local, and said plainly rather than dressed up: this closes the replay
 * against the worker that served the session, which is the whole fleet today.
 * Several workers need the token server's own `session_usage` ledger consulted
 * on the join path, which is a change to `server.ts` and is filed, not assumed.
 */
const reportedSessions = new Set<string>();

/** Record that a session's seconds have been reported and its room is spent. */
export function noteSessionReported(sessionId: string): void {
  if (sessionId === UNSIGNED_SESSION_ID) return;
  reportedSessions.add(sessionId);
  // Oldest first. An id old enough to fall out of this window is long past the
  // expiry of any credential that could name it.
  while (reportedSessions.size > REPORTED_SESSIONS_KEPT) {
    const oldest = reportedSessions.values().next();
    if (oldest.done) break;
    reportedSessions.delete(oldest.value);
  }
}

/** Has this worker already reported this session? */
export function sessionAlreadyReported(sessionId: string): boolean {
  return sessionId !== UNSIGNED_SESSION_ID && reportedSessions.has(sessionId);
}

/** Test seam: one test's replay must never be another test's history. */
export function forgetReportedSessions(): void {
  reportedSessions.clear();
}

export class LuvaniTutor extends voice.Agent {
  private state: SessionState;
  private silenceTimer?: ReturnType<typeof setTimeout>;
  // Not a constructor parameter property — Node runs this worker by stripping
  // types, and parameter properties emit runtime code, so they are rejected.
  private readonly lesson: Lesson;
  private publish: Publisher = () => {};
  private startedAt = Date.now();
  private ended = false;
  /** Every mutation of `state` goes through here, one at a time. */
  private readonly queue = new TurnQueue();
  /** True between the learner starting to talk and their turn being applied. */
  private learnerSpeaking = false;
  /**
   * Turns the learner actually produced: spoken, typed, tapped, or asked for
   * help on. Everything except the silence rescue, which is the one input the
   * agent applies on their behalf. Billing reads this and never the ladder's
   * turn index — see `finish()`.
   */
  private learnerTurns = 0;
  /** A spent credential re-opened this room, so this tutor never goes on air. */
  private refused = false;
  /** Keeps a copy of each utterance on its way to the recogniser. */
  private readonly tap = new UtteranceTap();

  /**
   * Voiceless: the lesson runs with no microphone and no speech at all.
   *
   * The scripted turn is already published in full — the tutor's line, the
   * target, the support view — so a typed lesson needs no model call and no TTS
   * to be a lesson. The ladder, the rescue and the summary are the same code;
   * only the delivery changes. A learner on a quiet train is still a learner.
   *
   * Not readonly, because the learner may change their mind. The `mode` frame
   * flips exactly this, mid-lesson, and nothing else moves: see `setVoiceless`.
   */
  private voiceless: boolean;

  /**
   * The person the learner chose to be taught by, or nothing.
   *
   * Held rather than resolved. `undefined` means nobody chose, and
   * `buildPrompt` answers that from the catalogue — so this class never states
   * a second opinion about who the tutor is by default, and a learner who has
   * never picked gets exactly the prompt they got before this field existed.
   *
   * The agent is what resolves it, because it is the only process holding the
   * vendor key that decides which voice actually speaks. This class only has to
   * make sure the same person survives every render of the prompt.
   */
  private readonly persona: TutorPersona | undefined;

  constructor(lesson: Lesson, startRung?: Rung, options: { voiceless?: boolean; persona?: TutorPersona } = {}) {
    const state = createSession(lesson, startRung);
    const prompt = currentPrompt(lesson, state);
    super({ instructions: buildPrompt(lesson, prompt.turn, prompt.directive, options.persona) });
    this.lesson = lesson;
    this.state = state;
    this.voiceless = options.voiceless ?? false;
    this.persona = options.persona;
  }

  get sessionState(): SessionState {
    return this.state;
  }

  /** Wire up the channel back to the app. */
  attach(publish: Publisher): void {
    this.publish = publish;
    // The refusal is decided when the signed session id lands, which is before
    // there is any channel back to the app. Say it now or nobody hears it.
    if (this.refused) this.publishError(REPLAYED_SESSION_MESSAGE);
  }

  /** Send the app whatever it should be rendering right now. */
  sendCurrentPrompt(session?: voice.AgentSession): void {
    if (this.refused || this.state.finished) return;
    this.publish({ t: 'prompt', prompt: currentPrompt(this.lesson, this.state) });
    // With no speech there is no AgentStateChanged to start the silence clock,
    // and the moment the turn renders is the moment they have the floor.
    if (this.voiceless && session) this.armRescue(session);
  }

  /** Drives the microphone control: live while the learner has the floor. */
  sendSpeaking(speaking: boolean): void {
    this.publish({ t: 'speaking', speaking });
  }

  /** Tell the learner something went wrong, in plain unscolding words. */
  publishError(message: string): void {
    this.publish({ t: 'error', message });
  }

  /**
   * Handle explicit high-risk content before grading or model context.
   *
   * The words leave on the `safety` frame and not on `error`. They are the same
   * words either way, but the app renders severity from the tag: an `error` is
   * a self-clearing notice built for a TTS outage, and a crisis line that
   * removes itself after eight seconds is worse than not saying it. Sent once,
   * on one channel, because both ends of this ship from one repo and a doubled
   * send would give a current app the vanishing toast as well as the surface
   * that stays.
   */
  private handleSafety(text: string, session?: voice.AgentSession): boolean {
    const decision = safetyDecision(text);
    if (decision === null) return false;
    this.clearRescue();
    recordSafetyDecision({
      sessionId: this.sessionId,
      category: decision.category,
      action: decision.action,
      rule: decision.rule,
      mode: 'lesson',
      voiceless: this.voiceless,
    });
    const delivered = this.publish({ t: 'safety', category: decision.category, action: decision.action, message: decision.message });
    const spoken = !this.voiceless && session ? session.say(decision.message, { allowInterruptions: false }) : undefined;
    if (decision.action === 'stop') void this.closeAfterStop(delivered, spoken);
    return true;
  }

  /**
   * A stop, all the way through: the words, then the room.
   *
   * The same sequence as the conversation agent's, for the same reason and in
   * the same order, because the two tutors have to be one person at the worst
   * moment of somebody's day. After a stop this session will neither hear nor
   * answer, and until the room closed the microphone stayed published and the
   * recogniser kept transcribing into it.
   *
   * `finish()` is started and not awaited: it debits the seconds, and the room
   * should not wait on a billing round trip to stop listening. Delivery is
   * waited on, because it is the point. In a spoken lesson that is the speech
   * handle; in a typed one the reliable data frame is the only delivery there
   * is, and disconnecting before it flushes would take the message with it.
   */
  private async closeAfterStop(delivered: void | Promise<void>, spoken: SpokenLine): Promise<void> {
    void this.finish();
    try {
      await delivered;
      await spoken?.waitForPlayout();
    } catch (error) {
      console.warn('[luvani] the stop message did not settle cleanly; closing the room anyway:', error);
    }
    this.closeRoom();
  }

  /**
   * The worker's own room close, wired by agent.ts. Unwired (tests) it costs
   * nothing. The tutor never disconnects anything itself; it owns the judgement
   * that the session is over, and the worker owns the room.
   */
  private closeRoom: () => void = () => {};

  /** Wire the room's disconnect. See `closeAfterStop` for when it is called. */
  attachRoomClose(close: () => void): void {
    this.closeRoom = close;
  }

  /** Handle an intent the learner expressed by tapping rather than speaking. */
  async handleClientMessage(session: voice.AgentSession, payload: Uint8Array): Promise<void> {
    if (this.refused) return; // a spent credential gets no lesson, whatever it taps
    const msg = decodeClientMessage(payload);
    if (!msg) return; // a malformed frame must not disturb a live conversation

    if (msg.t === 'ready') return this.sendCurrentPrompt();
    if (msg.t === 'leave') return void this.finish();
    if (msg.t === 'mode') return this.setVoiceless(session, msg.voiceless);

    if (msg.t === 'typing' || msg.t === 'moment') {
      // Presence, not silence. Someone typing an answer, or saying they need a
      // second, is a learner with the floor, and stepping in over them is a
      // remark on hesitating that this tutor never makes.
      //
      // Only ever a restart: if no clock is running, none is started. armRescue
      // owns when the tutor may wait on a learner at all, and a keystroke must
      // not be a second opinion about that. This is the answer LuvaniConversation
      // already settled on.
      if (this.silenceTimer) this.armRescue(session);
      return;
    }

    // Both, and not `say` alone. Ten lines down, `choice || say` publishes the
    // text as a transcript and grades it, so a tapped option's words reached
    // the transcript, the ladder and the model unread — in the mode that
    // carries the whole scripted lesson, where tapping IS how a learner
    // answers. One guard, and it covers every way an answer arrives.
    if ((msg.t === 'say' || msg.t === 'choice') && this.handleSafety(msg.text, session)) return;
    if (msg.t === 'hear') {
      // Replay the line to say, uninterruptible so it always plays out whole.
      // Scripted lines come from the TTS cache, so a replay costs nothing.
      if (this.voiceless) return;
      const prompt = currentPrompt(this.lesson, this.state);
      session.say(prompt.turn.target, { allowInterruptions: false });
      return;
    }

    // A tapped option and a typed line are both answers. They are graded exactly
    // as a spoken turn would be — the ladder does not care how the words
    // arrived — but they carry no phonemes, so nothing counts them as an
    // utterance that was listened to and the end card keeps saying so.
    if (msg.t === 'choice' || msg.t === 'say') {
      const text = msg.text.trim();
      if (text.length === 0) return;
      this.publish({ t: 'transcript', text, final: true });
      await this.enqueue(session, { type: 'spoke', transcript: text, phonemes: [], durationSec: 0 });
      return;
    }

    const input = toLearnerInput(msg);
    if (input) await this.enqueue(session, input);
  }

  /**
   * Go quiet, or come back to voice, without leaving the lesson.
   *
   * The conversation agent's `setVoiceless`, said in this class's words, and
   * deliberately the same three moves: flip the one flag every spoken line and
   * the silence clock already read, re-arm a clock that was already running so
   * the learner is measured on the pace they are now working at, and say
   * nothing about it. The two tutors have to be one person, and a control that
   * behaved differently depending on which one you were talking to would be two.
   *
   * Nothing is torn down and nothing is interrupted. A line already on its way
   * out finishes; nothing new is spoken after this returns. The rung, the turn
   * and the metered seconds carry on untouched, because changing how a lesson
   * reaches you is not a thing you can get wrong.
   */
  setVoiceless(session: voice.AgentSession, voiceless: boolean): void {
    if (this.voiceless === voiceless) return;
    this.voiceless = voiceless;
    if (this.silenceTimer) this.armRescue(session);
  }

  /**
   * Speech options for the next tutor reply.
   *
   * On the scripted rungs the modelled line must play out in full: without
   * headphones the learner's microphone hears the tutor, and a VAD "interruption"
   * during the model line is almost never the learner talking.
   */
  replyOptions(): { allowInterruptions?: boolean } {
    const directive = currentPrompt(this.lesson, this.state).directive;
    return directive.rung <= 2 || directive.rescued ? { allowInterruptions: false } : {};
  }

  /**
   * Arm the rescue.
   *
   * Called once the tutor has finished speaking. If nothing has arrived by the
   * end of the window below they are stuck, not thinking, and the ladder drops
   * a rung so the next prompt carries more support.
   */
  armRescue(session: voice.AgentSession): number {
    this.clearRescue();
    // Captured now, checked when the timer fires. Returned so the caller — and
    // a test — can name the moment this particular wait began.
    const generation = this.queue.generation;
    if (this.ended) return generation;

    this.silenceTimer = setTimeout(() => void this.runRescue(session, generation), this.silenceWindow());
    return generation;
  }

  /**
   * How long nothing may happen before the learner is stuck rather than
   * thinking.
   *
   * Four seconds is a voice rule. Typing is slower than speaking, and a learner
   * composing one sentence was rescued every four seconds by a clock whose only
   * evidence was that nobody had spoken — which drops a rung, counts a rescue,
   * and writes the rung tomorrow opens on. Twelve seconds of nothing in a typed
   * lesson still means stuck, and the answer is the same answer LuvaniConversation
   * already gives.
   */
  private silenceWindow(): number {
    return this.voiceless ? TEXT_SILENCE_MS : STUCK_SILENCE_MS;
  }

  /**
   * The rescue itself, separated from the timer that schedules it.
   *
   * Clearing a timeout cannot unschedule a callback that has already fired, so
   * "the learner started talking half a beat after the clock ran out" arrives
   * here with the rescue already in flight. Two things stop it: they are
   * currently speaking, or something else has been queued since this wait began
   * — either way the silence it was going to report is silence that ended.
   */
  async runRescue(session: voice.AgentSession, generation: number): Promise<void> {
    if (this.ended || this.learnerSpeaking) return;
    await this.queue.runIfCurrent(generation, () =>
      this.applyInput(session, { type: 'silence', durationMs: this.silenceWindow() }),
    );
  }

  /**
   * The learner has the floor, or has given it up.
   *
   * Set from the session's user-state events. A rescue armed before they opened
   * their mouth is stale the moment they do.
   */
  setLearnerSpeaking(speaking: boolean): void {
    this.learnerSpeaking = speaking;
    if (speaking) this.clearRescue();
  }

  /** Settle once every queued turn has been applied. For tests. */
  settled(): Promise<void> {
    return this.queue.idle();
  }

  clearRescue(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = undefined;
  }

  /**
   * Sit in front of recognition so the audio can be scored, not just read.
   *
   * The frames are passed straight through — the recogniser sees exactly what it
   * would have seen — and the events come back through the same treatment, which
   * is where the end of an utterance is noticed and the audio cut out of the
   * buffer. Recognition itself is still the framework's own implementation.
   */
  override async sttNode(
    audio: ReadableStream<AudioFrame> | AsyncIterable<AudioFrame>,
    modelSettings: Parameters<voice.Agent['sttNode']>[1],
  ): Promise<ReadableStream<stt.SpeechEvent | string> | null> {
    const events = await voice.Agent.default.sttNode(this, observeFrames(audio, this.tap), modelSettings);
    if (!events) return events;
    return ReadableStream.from(observeEvents(events, this.tap)) as ReadableStream<stt.SpeechEvent | string>;
  }

  /** The learner said something. Grade it, move the ladder, re-brief the tutor. */
  override async onUserTurnCompleted(_chatCtx: llm.ChatContext, newMessage: llm.ChatMessage): Promise<void> {
    if (this.refused) throw new voice.StopResponse();
    this.clearRescue();
    this.learnerSpeaking = false;
    const transcript = newMessage.textContent ?? '';

    // A turn that ends with no words is a cough, a door, a passing bus, or the
    // tutor's own voice arriving back through a speakerphone. Returning here
    // used to leave the pipeline free to generate a reply of its own — off the
    // ladder, at whatever length it fancied, to a learner who had said nothing.
    // Re-arm the clock they were halfway through and stay quiet.
    if (!transcript.trim()) {
      this.armRescue(this.session);
      throw new voice.StopResponse();
    }

    if (this.handleSafety(transcript, this.session)) throw new voice.StopResponse();

    this.publish({ t: 'transcript', text: transcript, final: true });

    const prompt = currentPrompt(this.lesson, this.state);
    const utterance = this.tap.take();
    // Reference text is what makes accuracy scoring meaningful at all — see the
    // note in packages/core/src/lessons/types.ts.
    const phonemes = await scoreUtterance({
      reference: prompt.turn.reference,
      ...(audioScoringEnabled() && utterance?.wav ? { audio: utterance.wav } : {}),
    });

    await this.enqueue(this.session, {
      type: 'spoke',
      transcript,
      phonemes,
      // Measured by the recogniser, not guessed. Zero here is what made
      // speaking share and longest turn read as nothing on every live session.
      durationSec: utterance?.durationSec ?? 0,
    });

    // applyInput generated the reply itself, under the interruption rules the
    // current rung demands. Cancel the pipeline's own automatic reply — it
    // would speak a second time, and with interruptions allowed, which is how
    // a speakerphone mic gets to cut the modelled line off mid-sentence.
    throw new voice.StopResponse();
  }

  /**
   * Apply one learner input, in its turn.
   *
   * Everything that moves the session goes through the queue: a spoken turn, a
   * rescue, a tap, a skip. Interleaving two of them corrupts the ladder and
   * generates two replies for one turn.
   */
  private enqueue(session: voice.AgentSession | undefined, input: Parameters<typeof submitTurn>[2]): Promise<void> {
    return this.queue.run(() => this.applyInput(session, input));
  }

  private async applyInput(session: voice.AgentSession | undefined, input: Parameters<typeof submitTurn>[2]): Promise<void> {
    // `silence` is the rescue, which the agent applies on the learner's behalf.
    // Everything else arrived from their mouth, their keyboard or their thumb,
    // and that difference is exactly what billing keys off in `finish()`.
    if (input.type !== 'silence') this.learnerTurns += 1;
    const { state, feedback } = submitTurn(this.lesson, this.state, input);
    this.state = state;

    if (feedback.message) this.publish({ t: 'feedback', feedback });

    if (state.finished) return void this.finish();

    const next = currentPrompt(this.lesson, state);
    // The persona rides every rebuild, not just the first one. This line runs
    // on every applied turn, so a `buildPrompt` call without it here does not
    // fail — it quietly swaps the tutor for the catalogue default one turn into
    // the lesson, while the voice saying the words does not change. That is the
    // F292 mismatch arriving late instead of at the start, and it is invisible
    // to any test that only checks the constructor.
    await this.updateInstructions(buildPrompt(this.lesson, next.turn, next.directive, this.persona));
    this.publish({ t: 'prompt', prompt: next });

    // The tutor answers every applied input — a spoken turn, a rescue, a skip —
    // and always through replyOptions(), so a modelled line on a scripted rung
    // can never be cut off by the mic hearing the tutor's own voice.
    if (session && !this.voiceless) {
      session.generateReply(this.replyOptions());
    } else if (session) {
      // Nothing is going to speak, so nothing will hand the floor back. The
      // published turn is the handover, and the clock starts with it.
      this.armRescue(session);
    }
  }

  /**
   * End the session: send the card, then debit the metered seconds.
   *
   * Idempotent, because both a finished lesson and a learner closing the app can
   * arrive here — and billing someone twice for one session is the kind of bug
   * that costs a refund and a review.
   */
  async finish(): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.clearRescue();

    const summary = summarise(this.state);
    this.publish({ t: 'summary', summary });

    const wallClockSec = Math.round((Date.now() - this.startedAt) / 1000);
    console.log(
      `[luvani] session complete — ${summary.turnsCompleted} turns (${this.learnerTurns} from the learner), ` +
        `${summary.wordsProduced.length} words, ${wallClockSec}s, ` +
        `focus=${summary.pronunciation.focus?.phoneme.ipa ?? 'none'}`,
    );
    // A room that never delivered a learner turn is an unusable start, not a
    // product the learner should pay for: a dead microphone, a recogniser that
    // never answered, a room they could not hear. Reporting zero still releases
    // the active-session lease and records the session id exactly once.
    //
    // Counted here rather than read off `summary.turnsCompleted`, which is the
    // ladder's turn index. The silence rescue applies a `silence` input, and
    // that advances the index — so this guard used to be defeated by the learner
    // saying nothing, which is the exact case it exists for. Measured live: a
    // room the harness never spoke in debited 60s (F76).
    const billableSeconds = this.learnerTurns > 0 ? wallClockSec : 0;
    if (billableSeconds === 0) {
      // Greppable on purpose. If these start appearing in numbers, rooms are
      // reaching learners unusable and the vendor bill is being paid for them.
      console.log(`[luvani] SESSION_NOT_CHARGED session=${this.sessionId.slice(0, 8)} reason=no-learner-turn`);
    }
    // Spent before the call goes out: a crash between here and the debit must
    // not leave a used credential looking fresh to the next room it opens.
    noteSessionReported(this.sessionId);
    await reportUsage({
      userId: this.learnerId,
      sessionId: this.sessionId,
      seconds: billableSeconds,
      utterancesScored: summary.utterancesScored,
    });
  }

  /** Set from the room identity so usage lands on the right account. */
  learnerId = 'anonymous';

  private sessionIdValue = UNSIGNED_SESSION_ID;

  /** Signed into the join token; retries with this id can never double-debit. */
  get sessionId(): string {
    return this.sessionIdValue;
  }

  /**
   * Where the replay check lands, because this is where the signed session id
   * arrives: agent.ts reads it out of the join credential's metadata and writes
   * it here before the tutor has said a word or armed a clock.
   *
   * A credential whose session has already been reported is spent, and the room
   * it just re-opened is not a session — so the tutor takes itself off the air
   * instead of teaching a lesson that can never be charged for.
   */
  set sessionId(value: string) {
    this.sessionIdValue = value;
    if (!sessionAlreadyReported(value)) return;
    this.refused = true;
    // `ended` is what makes finish() a no-op and stops the rescue arming, so
    // from here nothing can debit, speak, or move the ladder.
    this.ended = true;
    this.clearRescue();
    console.warn(`[luvani] refused a replayed join credential for session ${value.slice(0, 8)}`);
  }
}
