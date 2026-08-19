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
 * The pedagogy itself is @parle/core's, unmodified — the same ladder, lesson and
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
} from '@parle/core';
import { buildPrompt } from './prompt.ts';
import { scoreUtterance } from './speechace.ts';
import { reportUsage } from './usage.ts';
import { TurnQueue } from './queue.ts';
import { UtteranceTap, audioScoringEnabled, observeEvents, observeFrames } from './utterance.ts';

/** Anything that can carry a message back to the app. */
type Publisher = (message: ServerMessage) => void;

export class ParleTutor extends voice.Agent {
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
  /** Keeps a copy of each utterance on its way to the recogniser. */
  private readonly tap = new UtteranceTap();

  constructor(lesson: Lesson, startRung?: Rung) {
    const state = createSession(lesson, startRung);
    const prompt = currentPrompt(lesson, state);
    super({ instructions: buildPrompt(lesson, prompt.turn, prompt.directive) });
    this.lesson = lesson;
    this.state = state;
  }

  get sessionState(): SessionState {
    return this.state;
  }

  /** Wire up the channel back to the app. */
  attach(publish: Publisher): void {
    this.publish = publish;
  }

  /** Send the app whatever it should be rendering right now. */
  sendCurrentPrompt(): void {
    if (this.state.finished) return;
    this.publish({ t: 'prompt', prompt: currentPrompt(this.lesson, this.state) });
  }

  /** Drives the microphone control: live while the learner has the floor. */
  sendSpeaking(speaking: boolean): void {
    this.publish({ t: 'speaking', speaking });
  }

  /** Tell the learner something went wrong, in plain unscolding words. */
  publishError(message: string): void {
    this.publish({ t: 'error', message });
  }

  /** Handle an intent the learner expressed by tapping rather than speaking. */
  async handleClientMessage(session: voice.AgentSession, payload: Uint8Array): Promise<void> {
    const msg = decodeClientMessage(payload);
    if (!msg) return; // a malformed frame must not disturb a live conversation

    if (msg.t === 'ready') return this.sendCurrentPrompt();
    if (msg.t === 'leave') return void this.finish();
    if (msg.t === 'hear') {
      // Replay the line to say, uninterruptible so it always plays out whole.
      // Scripted lines come from the TTS cache, so a replay costs nothing.
      const prompt = currentPrompt(this.lesson, this.state);
      session.say(prompt.turn.target, { allowInterruptions: false });
      return;
    }

    const input = toLearnerInput(msg);
    if (input) await this.enqueue(session, input);
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
   * Called once the tutor has finished speaking. If the learner has not started
   * talking within four seconds they are stuck, not thinking, and the ladder drops
   * a rung so the next prompt carries more support.
   */
  armRescue(session: voice.AgentSession): number {
    this.clearRescue();
    // Captured now, checked when the timer fires. Returned so the caller — and
    // a test — can name the moment this particular wait began.
    const generation = this.queue.generation;
    if (this.ended) return generation;

    this.silenceTimer = setTimeout(() => void this.runRescue(session, generation), STUCK_SILENCE_MS);
    return generation;
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
      this.applyInput(session, { type: 'silence', durationMs: STUCK_SILENCE_MS }),
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
    const { state, feedback } = submitTurn(this.lesson, this.state, input);
    this.state = state;

    if (feedback.message) this.publish({ t: 'feedback', feedback });

    if (state.finished) return void this.finish();

    const next = currentPrompt(this.lesson, state);
    await this.updateInstructions(buildPrompt(this.lesson, next.turn, next.directive));
    this.publish({ t: 'prompt', prompt: next });

    // The tutor answers every applied input — a spoken turn, a rescue, a skip —
    // and always through replyOptions(), so a modelled line on a scripted rung
    // can never be cut off by the mic hearing the tutor's own voice.
    if (session) {
      session.generateReply(this.replyOptions());
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
      `[parle] session complete — ${summary.turnsCompleted} turns, ${summary.wordsProduced.length} words, ` +
        `${wallClockSec}s, focus=${summary.pronunciation.focus?.phoneme.ipa ?? 'none'}`,
    );
    await reportUsage({ userId: this.learnerId, seconds: wallClockSec, utterancesScored: summary.utterancesScored });
  }

  /** Set from the room identity so usage lands on the right account. */
  learnerId = 'anonymous';
}
