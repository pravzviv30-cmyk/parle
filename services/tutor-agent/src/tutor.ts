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
  addPronunciation,
  createSession,
  currentPrompt,
  directiveFor,
  isGuestSceneTurnId,
  parseGuestSceneTurnIds,
  submitTurn,
  summarise,
  toLearnerInput,
  STUCK_SILENCE_MS,
  type GuestSceneTurnId,
  type Lesson,
  type LessonTurn,
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
import { MOMENT_GRACE_MS, TEXT_SILENCE_MS } from './convo.ts';
import { buildPrompt } from './prompt.ts';
import { scriptedSpeech } from './scriptedSpeech.ts';
import { scoreUtterance } from '../../shared/pronunciation.ts';
import { LESSON_SCORING_EFFECTS } from '../../shared/lessonScoringQuote.ts';
import { LIVE_SCORE_TIMEOUT_MS, LiveScoring, SCORE_SETTLE_MS, SETTLE_DEADLINE_MARGIN_SEC, nearHardLimit, saidTheLine } from './liveScoring.ts';
import { reportUsage } from './usage.ts';
import { terminalServiceFailure } from './serviceFailure.ts';
import type { ServiceFailure } from '@luvani/core';
import { CommandBudget, replayPlayout, TurnQueue } from './queue.ts';
import { safeError } from './safeError.ts';
import { INPUT_BUSY_MESSAGE, INPUT_LIMIT_MESSAGE, readClientInput } from './runtimeInput.ts';
import { UtteranceTap, audioScoringEnabled, observeEvents, observeFrames } from './utterance.ts';
import { NO_CLIP_SINK, mayCapture, speechDatasetEnabled, type ClipCandidate, type ClipSink } from './speechClips.ts';
import { observeRecognitionConfidence } from './recognitionConfidence.ts';
import { isAcceptedLearnerText, outputGuard, recordSafetyDecision, safetyDecision } from './safety.ts';
import type { RuntimeLifecycle } from './sessionLifecycle.ts';

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

/** Buffer one finite reply so no unsafe prefix can reach either text or TTS. */
export function guardScriptedOutput(source: ReadableStream<llm.ChatChunk | string>, options: {
  fallback: string; signal?: AbortSignal; timeoutMs?: number;
  suppressed?: (finding: ReturnType<typeof outputGuard>) => void;
  unavailable?: () => void;
}): ReadableStream<string> {
  const reader = source.getReader();
  let cancelled = false, outputCancelled = false;
  let interrupt: (error: unknown) => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => { interrupt = reject; });
  void stopped.catch(() => {});
  const abort = () => { cancelled = true; interrupt(new voice.StopResponse()); void reader.cancel().catch(() => {}); };
  options.signal?.addEventListener('abort', abort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  return new ReadableStream<string>({
    async start(controller) {
      let text = '', bytes = 0, chunks = 0, suppressed = false;
      timer = setTimeout(() => interrupt(new Error('Scripted reply unavailable')), options.timeoutMs ?? 10_000);
      try {
        if (options.signal?.aborted) { abort(); throw new voice.StopResponse(); }
        for (;;) {
          const part = await Promise.race([reader.read(), stopped]);
          if (part.done) break;
          const chunk = part.value;
          const content = typeof chunk === 'string' ? chunk : chunk.delta?.content ?? '';
          // Scripted lessons register no tools. Refuse unexpected calls instead
          // of executing semantics that cannot pass a text safety boundary.
          if ((typeof chunk !== 'string' && chunk.delta?.toolCalls?.length) || ++chunks > 1_024
            || (bytes += Buffer.byteLength(content)) > 8_192) { suppressed = true; break; }
          text += content;
        }
        if (cancelled || options.signal?.aborted) throw new voice.StopResponse();
        const finding = suppressed ? null : outputGuard(text);
        if (suppressed || finding) { options.suppressed?.(finding); text = options.fallback; }
        if (Buffer.byteLength(text) > 8_192 || outputGuard(text)) text = 'On continue. Vas-y, je t’écoute.';
        if (text) controller.enqueue(text);
        controller.close();
      } catch {
        if (!cancelled && !options.signal?.aborted) options.unavailable?.();
        if (!outputCancelled) controller.error(new Error('Scripted reply unavailable'));
      } finally {
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        void reader.cancel().catch(() => {});
      }
    },
    cancel() { outputCancelled = true; abort(); },
  });
}

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

// The background scorer moved to liveScoring.ts so the conversation shares it;
// these stay exported from here so existing imports keep working.
export { SCORE_SETTLE_MS, SETTLE_DEADLINE_MARGIN_SEC, LIVE_SCORE_TIMEOUT_MS };

/**
 * Did the learner say this turn's reference line? See `saidTheLine`: an
 * accepted alternative or a different option is never scored.
 */
export function saidTheReferenceLine(turn: LessonTurn, transcript: string): boolean {
  return saidTheLine(turn.reference, transcript);
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
  private finishing: Promise<void> | null = null;
  private lifecycle: RuntimeLifecycle | undefined;
  private acknowledgedState: SessionState;
  /** Every mutation of `state` goes through here, one at a time. */
  private readonly queue = new TurnQueue();
  private readonly replayQueue = new TurnQueue({ maxPending: 1 });
  private readonly commands = new CommandBudget();
  private lastInputNotice = -Infinity;
  /** True between the learner starting to talk and their turn being applied. */
  private learnerSpeaking = false;
  /**
   * Turns the learner actually produced: spoken, typed, tapped, or asked for
   * help on. Everything except the silence rescue, which is the one input the
   * agent applies on their behalf. Billing reads this and never the ladder's
   * turn index — see `finish()`.
   */
  private learnerTurns = 0;
  private serviceFailure: ServiceFailure | null = null;
  terminalFailureFor(kind: unknown, recoverable: unknown, learnerPresent: boolean): ServiceFailure | null {
    const failure = terminalServiceFailure({ kind, recoverable, learnerPresent, ended: this.ended, voiceless: this.voiceless });
    if (failure) this.serviceFailure ??= failure;
    return failure;
  }
  /** A spent credential re-opened this room, so this tutor never goes on air. */
  private refused = false;
  /** Keeps a copy of each utterance on its way to the recogniser. */
  private readonly tap = new UtteranceTap();
  /**
   * Sound evidence gathered beside the turns. Kept out of the queued lesson
   * state on purpose: a score lands whenever the vendor answers, and the
   * ladder and the checkpoints never wait for it.
   */
  private readonly scoring: LiveScoring;
  /** A safety stop is closing this room; nothing waits on a score now. */
  private stopping = false;

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

  /** Where a consented dataset clip would go. Today only NO_CLIP_SINK exists. */
  private readonly clipSink: ClipSink;

  /**
   * The learner's consent to give reference-line clips to the speech dataset.
   *
   * A constructor option, read once and never reassigned. Nothing in
   * production code passes it today, so it is always false and nothing is
   * captured. Activation passes it from agent.ts after the token server signs
   * a consent bit, read from a server consent record, into join metadata (as
   * `memoryLocked` is). See docs/changes/speech-dataset.md.
   */
  private readonly datasetConsent: boolean;

  /**
   * No model at all: an unexpected answer gets the scripted rescue instead of
   * generateReply, llmNode never runs, nothing is scored, and a safety message
   * is shown rather than spoken (it is not on the scene's TTS allow-list).
   */
  private readonly scriptOnly: boolean;
  /** A guest scene records the turns answered acceptably and reports them. */
  private readonly scene: boolean;
  private readonly sceneTurnIds = new Set<GuestSceneTurnId>();
  /** Scene turns the learner answered at all (any spoken or typed line). */
  private readonly sceneAnsweredIds = new Set<string>();

  constructor(lesson: Lesson, startRung?: Rung, options: { voiceless?: boolean; persona?: TutorPersona; scoringRequest?: typeof fetch; scorer?: typeof scoreUtterance; clipSink?: ClipSink; datasetConsent?: boolean; scriptOnly?: boolean; scene?: boolean } = {}) {
    const state = createSession(lesson, startRung);
    const prompt = currentPrompt(lesson, state);
    super({ instructions: buildPrompt(lesson, prompt.turn, prompt.directive, options.persona) });
    this.lesson = lesson;
    this.state = state;
    this.acknowledgedState = state;
    this.voiceless = options.voiceless ?? false;
    this.persona = options.persona;
    this.scoring = new LiveScoring({ scoringRequest: options.scoringRequest, scorer: options.scorer,
      signal: () => this.lifecycle?.signal, maxScores: LESSON_SCORING_EFFECTS });
    this.clipSink = options.clipSink ?? NO_CLIP_SINK;
    this.datasetConsent = options.datasetConsent === true;
    this.scriptOnly = options.scriptOnly === true || options.scene === true;
    this.scene = options.scene === true;
  }

  /** Scene turn ids answered acceptably so far, in scene order. */
  get sceneTurns(): GuestSceneTurnId[] {
    return parseGuestSceneTurnIds([...this.sceneTurnIds]) ?? [];
  }

  private sceneReport(finished: boolean): { sceneTurns?: GuestSceneTurnId[]; firstPracticeComplete?: boolean; firstPracticeStopped?: boolean } {
    if (!this.scene) return {};
    // Complete only when every turn got a line from the learner. A skip or a
    // help request can move a turn on, but it is not an answer.
    const everyTurnAnswered = this.lesson.turns.every(turn => this.sceneAnsweredIds.has(turn.id));
    return { sceneTurns: this.sceneTurns, firstPracticeComplete: finished && this.learnerTurns > 0 && everyTurnAnswered,
      ...(this.stopping ? { firstPracticeStopped: true } : {}) };
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

  attachLifecycle(lifecycle: RuntimeLifecycle): void { this.lifecycle = lifecycle; }

  /** Stop queued generation and active speech before durable cleanup begins. */
  cancelLiveReplies(): void {
    this.queue.clearPending(); this.replayQueue.clearPending(); this.clearRescue();
    try { void Promise.resolve(this.session.interrupt({ force: true })).catch(() => {}); } catch { /* session not started */ }
  }

  override async onExit(): Promise<void> { await this.finish(); }

  override async llmNode(
    chatCtx: Parameters<voice.Agent['llmNode']>[0],
    toolCtx: Parameters<voice.Agent['llmNode']>[1],
    modelSettings: Parameters<voice.Agent['llmNode']>[2],
  ): ReturnType<voice.Agent['llmNode']> {
    if (this.ended || this.voiceless || this.scriptOnly) throw new voice.StopResponse();
    this.lifecycle?.assertActive();
    const source = await voice.Agent.default.llmNode(this, chatCtx, toolCtx, modelSettings);
    if (!source) return source;
    return guardScriptedOutput(source, {
      fallback: currentPrompt(this.lesson, this.state).turn.tutor,
      signal: this.lifecycle?.signal,
      suppressed: finding => {
        if (finding) recordSafetyDecision({ sessionId: this.sessionId, category: finding.category,
          action: 'suppress', rule: finding.rule, mode: 'lesson', voiceless: this.voiceless });
        else console.warn('[luvani] scripted reply exceeded its bounded text/tool contract');
      },
      unavailable: () => {
        this.serviceFailure ??= 'llm_error';
        this.cancelLiveReplies();
        void this.finish().finally(() => this.closeRoom()).catch(() => {});
      },
    });
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
  private rejectInput(message: string): void {
    const at = performance.now();
    if (at - this.lastInputNotice < 1_000) return;
    this.lastInputNotice = at;
    this.publish({ t: 'error', message });
  }

  private handleSafety(text: string, session?: voice.AgentSession): boolean {
    if (!isAcceptedLearnerText(text)) { this.rejectInput(INPUT_LIMIT_MESSAGE); return true; }
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
    const spoken = !this.voiceless && !this.scriptOnly && session ? session.say(decision.message, { allowInterruptions: false }) : undefined;
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
    this.stopping = true;
    void this.finish();
    try {
      await delivered;
      await spoken?.waitForPlayout();
    } catch (error) {
      console.warn('[luvani] the stop message did not settle cleanly; closing the room anyway:', safeError(error));
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
    const received = readClientInput(payload);
    if (!received.message) { if (received.reason === 'oversized') this.rejectInput(INPUT_LIMIT_MESSAGE); return; }
    const msg = received.message;
    if (this.ended && msg.t !== 'ready' && msg.t !== 'leave') return;

    if (msg.t === 'leave') { this.queue.clearPending(); this.replayQueue.clearPending();
      try { void Promise.resolve(session.interrupt({ force: true })).catch(() => {}); } catch { /* closed session */ }
      return void this.finish();
    }
    if (msg.t === 'mode') { if (msg.voiceless) this.replayQueue.clearPending(); return this.setVoiceless(session, msg.voiceless); }

    if ((msg.t === 'say' || msg.t === 'choice') && this.handleSafety(msg.text, session)) return;
    if (!this.commands.allow(msg.t) || (['say', 'choice', 'help', 'skip'].includes(msg.t) && this.queue.full)) { this.rejectInput(INPUT_BUSY_MESSAGE); return; }
    if (msg.t === 'ready') return this.sendCurrentPrompt();

    if (msg.t === 'typing') {
      // Presence, not silence. Someone typing an answer is a learner with the
      // floor, and stepping in over them is a remark on hesitating that this
      // tutor never makes.
      //
      // Only ever a restart: if no clock is running, none is started. armRescue
      // owns when the tutor may wait on a learner at all, and a keystroke must
      // not be a second opinion about that. This is the answer LuvaniConversation
      // already settled on.
      if (this.silenceTimer) this.armRescue(session);
      return;
    }
    if (msg.t === 'moment') {
      // "Give me a moment" asks for time, so it gets time: the same bounded
      // grace the conversation gives, not one more four-second window.
      this.deferForAMoment(session);
      return;
    }

    // Both, and not `say` alone. Ten lines down, `choice || say` publishes the
    // text as a transcript and grades it, so a tapped option's words reached
    // the transcript, the ladder and the model unread — in the mode that
    // carries the whole scripted lesson, where tapping IS how a learner
    // answers. One guard, and it covers every way an answer arrives.
    if (msg.t === 'hear') {
      // Replay the line to say, uninterruptible so it always plays out whole.
      // Scripted lines come from the TTS cache, so a replay costs nothing.
      if (this.voiceless) return;
      const prompt = currentPrompt(this.lesson, this.state);
      if (this.replayQueue.full) { this.rejectInput(INPUT_BUSY_MESSAGE); return; }
      void this.replayQueue.run(async signal => { if (!this.ended) await replayPlayout(session.say(prompt.turn.target, { allowInterruptions: false })?.waitForPlayout(), signal); })
        .catch(error => console.error('[luvani] replay did not finish:', safeError(error)));
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
   * Say the current turn straight from the script.
   *
   * Used for the opening line and for every expected answer, so the learner
   * hears the tutor as soon as their turn is applied instead of after a model
   * round trip. Text mode says nothing: the published prompt is the turn.
   */
  speakCurrentTurn(session: voice.AgentSession, options: { newTurn?: boolean; rescue?: boolean } = {}): void {
    if (this.ended || this.voiceless || this.refused) return;
    const prompt = currentPrompt(this.lesson, this.state);
    // The rescue phrasing models the line to repeat, whatever the rung.
    const directive = options.rescue ? directiveFor(prompt.directive.rung, true) : prompt.directive;
    const line = scriptedSpeech(prompt.turn, directive, { newTurn: options.newTurn });
    if (line.length > 0) session.say(line, this.replyOptions());
  }

  /**
   * Arm the rescue.
   *
   * Called once the tutor has finished speaking. If nothing has arrived by the
   * end of the window below they are stuck, not thinking, and the ladder drops
   * a rung so the next prompt carries more support.
   */
  armRescue(session: voice.AgentSession): number {
    // A grace already on the clock is not re-decided by the agent going back
    // to `listening`, which for a thinking learner is a stray sound.
    if (this.momentHeld && this.silenceTimer) return this.queue.generation;
    this.clearRescue();
    // Captured now, checked when the timer fires. Returned so the caller — and
    // a test — can name the moment this particular wait began.
    const generation = this.queue.generation;
    if (this.ended) return generation;

    this.silenceTimer = setTimeout(() => {
      // A fired timer is not a running clock; leaving the handle set would make
      // a stale grace check in armRescue refuse every later wait.
      this.silenceTimer = undefined;
      void this.runRescue(session, generation).catch(() => {});
    }, this.silenceWindow());
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
    // Taking the floor stands the ordinary clock down; a grace keeps running,
    // because runRescue already stands down while they hold the floor.
    if (speaking && !this.momentHeld) this.clearRescue();
  }

  /** True while the learner's asked-for time is running. */
  private momentHeld = false;

  /**
   * One bounded grace window, then the ordinary policy again. The same handle
   * as the silence clock, so everything that stands that clock down stands
   * this one down too, and the same length as LuvaniConversation's, so the two
   * tutors give the same answer to the same request.
   */
  private deferForAMoment(session: voice.AgentSession): void {
    if (this.ended) return;
    this.clearRescue();
    this.momentHeld = true;
    this.silenceTimer = setTimeout(() => {
      this.silenceTimer = undefined;
      this.momentHeld = false;
      this.armRescue(session);
    }, MOMENT_GRACE_MS);
  }

  /** Settle once every queued turn has been applied. For tests. */
  settled(): Promise<void> {
    return this.queue.idle();
  }

  clearRescue(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = undefined;
    // The grace lives on this one handle, so whatever stands the clock down
    // ends the grace too. A flag left behind would keep disabling the ordinary
    // rules (taking the floor, typing, a mode switch) with no clock to show for it.
    this.momentHeld = false;
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
    return ReadableStream.from(observeEvents(observeRecognitionConfidence(events), this.tap)) as ReadableStream<stt.SpeechEvent | string>;
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
    if (!this.commands.allow('say') || this.queue.full) { this.rejectInput(INPUT_BUSY_MESSAGE); throw new voice.StopResponse(); }

    this.publish({ t: 'transcript', text: transcript, final: true });

    const prompt = currentPrompt(this.lesson, this.state);
    const utterance = this.tap.take();
    // Scored beside the turn, never in front of it (F623). The reply below is
    // decided on the words alone and is said at once; the score joins the end
    // card's evidence whenever it lands. Reference text is what makes accuracy
    // scoring meaningful at all, so only a learner who said the reference line
    // is scored against it (see the note in packages/core/src/lessons/types.ts).
    if (!this.scriptOnly && audioScoringEnabled() && utterance && saidTheReferenceLine(prompt.turn, transcript)) {
      this.scoreInBackground(utterance.wav, prompt.turn.reference, this.lesson.id, prompt.turn.id, utterance.durationSec);
    }

    await this.enqueue(this.session, {
      type: 'spoke',
      transcript,
      phonemes: [],
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
   * Score one utterance without anybody waiting for it (see LiveScoring.score).
   * An utterance that comes back with evidence is offered as a dataset clip,
   * which `offerClip` drops unless the dataset flag and the learner's consent
   * are both on (VOICE-007). The clip carries the audio exactly as it was scored.
   */
  private scoreInBackground(wav: Uint8Array, reference: string, lessonId: string, turnId: string, durationSec: number): void {
    this.scoring.score(wav, reference, (observations, audio) =>
      this.offerClip({ reference, lessonId, turnId, wav: audio, durationSec, observations }));
  }

  /**
   * Offer a scored reference-line clip to the speech dataset seam, which is inert.
   *
   * Qualification is exactly VOICE-004's scoring gate: the learner said the
   * reference line, and typed or tapped answers never reach here. Capture
   * therefore also needs LUVANI_AUDIO_SCORING=1, on top of
   * the speech dataset flag and the learner's consent, which nothing passes today.
   *
   * The clip is the audio the scorer was handed. Through the paid transport
   * that is the converted 16 kHz mono WAV; the dev path sends the raw tap WAV,
   * and activation requires the converted 16 kHz audio
   * (docs/changes/speech-dataset.md). A sink can never break the lesson.
   */
  private offerClip(clip: ClipCandidate): void {
    if (!mayCapture({ enabled: speechDatasetEnabled(), consent: this.datasetConsent })) return;
    try { this.clipSink.offer(clip); } catch { /* the lesson goes on */ }
  }

  /**
   * Give scores still in flight a short, bounded chance to land, then close.
   *
   * Called before the lifecycle completes, because completing aborts the
   * signal every score is running on. A safety stop closes the room as soon as
   * its words are delivered, and a lesson ending at its hard limit needs every
   * second for settlement. Neither waits on a score.
   */
  private settleScores(): Promise<void> {
    return this.scoring.settle({ skip: this.stopping || nearHardLimit(this.lifecycle) });
  }

  /** The lesson state with the sound evidence gathered beside it. */
  private withPronunciation(state: SessionState): SessionState {
    return this.scoring.utterances.reduce(addPronunciation, state);
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
    if (this.ended) return;
    this.lifecycle?.assertActive();
    // `silence` is the rescue, which the agent applies on the learner's behalf.
    // Everything else arrived from their mouth, their keyboard or their thumb,
    // and that difference is exactly what billing keys off in `finish()`.
    const answered = currentPrompt(this.lesson, this.state).turn.id;
    const { state, feedback } = submitTurn(this.lesson, this.state, input);
    // THE SCENE RULE (scene path only; the core ladder is untouched for lessons):
    // silence never moves a guest scene on. The first rescue on a turn models
    // the line as usual; a rescue that would advance the turn is dropped, so
    // the scene waits for the learner until they answer, leave, or hit the
    // 180 s ceiling (which ends it as partial).
    if (this.scene && input.type === 'silence' && (feedback.advanced || state.finished)) return;
    if (input.type !== 'silence') { this.learnerTurns += 1; this.momentHeld = false; }
    if (this.scene && input.type === 'spoke') this.sceneAnsweredIds.add(answered);
    this.state = state;
    // Scene evidence: a spoken, typed or tapped answer (all arrive as `spoke`)
    // whose words were accepted and that was not graded poor. A rescue, a skip
    // or a help request never counts, because the learner did not produce it.
    if (this.scene && input.type === 'spoke' && feedback.wordsCorrect && feedback.quality !== 'poor' && isGuestSceneTurnId(answered)) {
      this.sceneTurnIds.add(answered);
    }

    if (this.lifecycle) {
      await this.lifecycle.checkpoint({ learnerTurns: this.learnerTurns,
        ...(this.serviceFailure ? { serviceFailure: this.serviceFailure } : {}), ...this.sceneReport(state.finished) }, () => { this.acknowledgedState = state; });
      if (this.ended) return;
      this.lifecycle.assertActive();
    }

    if (feedback.message) this.publish({ t: 'feedback', feedback });

    if (state.finished) return this.finish();

    const next = currentPrompt(this.lesson, state);
    // The persona rides every rebuild, not just the first one. This line runs
    // on every applied turn, so a `buildPrompt` call without it here does not
    // fail — it quietly swaps the tutor for the catalogue default one turn into
    // the lesson, while the voice saying the words does not change. That is the
    // F292 mismatch arriving late instead of at the start, and it is invisible
    // to any test that only checks the constructor.
    await this.updateInstructions(buildPrompt(this.lesson, next.turn, next.directive, this.persona));
    if (this.ended) return;
    this.lifecycle?.assertActive();
    this.publish({ t: 'prompt', prompt: next });

    // The tutor answers every applied input — a spoken turn, a rescue, a skip —
    // and always through replyOptions(), so a modelled line on a scripted rung
    // can never be cut off by the mic hearing the tutor's own voice.
    //
    // The script answers every path it expected, at once and from the TTS
    // cache. Only an answer the script did not expect (a miss, which can be
    // anything from a near-miss to a question in English) goes to the model,
    // because that is the one turn where a written reply adds something.
    if (session && !this.voiceless) {
      // A transcript that normalised to nothing is graded as a rescue, not a
      // miss, and gets the scripted rescue like any other.
      const unexpected = input.type === 'spoke' && feedback.quality === 'poor' && !feedback.rescued;
      if (unexpected && this.scriptOnly) this.speakCurrentTurn(session, { newTurn: feedback.advanced, rescue: true });
      else if (unexpected) session.generateReply(this.replyOptions());
      else this.speakCurrentTurn(session, { newTurn: feedback.advanced });
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
  finish(): Promise<void> {
    if (this.finishing) return this.finishing;
    if (this.ended) return Promise.resolve();
    this.finishing = this.complete();
    return this.finishing;
  }

  private async complete(): Promise<void> {
    this.lifecycle?.freezeBillingCutoff?.();
    // The legacy path bills wall-clock seconds; they stop here, not after the
    // wait for scores below.
    const endedAt = Date.now();
    this.ended = true;
    this.cancelLiveReplies();
    await this.settleScores();

    if (this.lifecycle) {
      const settlement = await this.lifecycle.complete({ learnerTurns: this.learnerTurns,
        ...(this.serviceFailure ? { serviceFailure: this.serviceFailure } : {}), ...this.sceneReport(this.state.finished) });
      this.state = this.withPronunciation(this.acknowledgedState);
      const summary = summarise(this.state);
      noteSessionReported(this.sessionId);
      await this.publish({ t: 'summary', summary });
      await this.publish({ t: 'settlement', result: settlement });
      return;
    }
    this.state = this.withPronunciation(this.state);
    const summary = summarise(this.state);
    this.publish({ t: 'summary', summary });

    const wallClockSec = Math.round((endedAt - this.startedAt) / 1000);
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
    const settlement = await reportUsage({
      userId: this.learnerId,
      sessionId: this.sessionId,
      seconds: billableSeconds,
      utterancesScored: summary.utterancesScored,
      ...(this.serviceFailure ? { serviceFailure: this.serviceFailure } : {}),
    });
    if (this.serviceFailure) await this.publish({ t: 'settlement', result: settlement });
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
