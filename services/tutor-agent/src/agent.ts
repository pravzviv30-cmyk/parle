/**
 * The tutor agent.
 *
 * A cascaded voice pipeline — Deepgram STT (fr) → Claude → ElevenLabs French TTS —
 * rather than a speech-to-speech model. Two reasons, both from the plan:
 * cost (a realtime model runs 2–4× the per-minute price) and control (we need the
 * learner's transcript and reference text in the loop to score pronunciation at
 * all, which a speech-to-speech model does not hand back).
 *
 * The important architectural decision is that this worker imports `@parle/core`
 * and runs *the same* tested ladder, lesson and grading code the app uses. The
 * pedagogy has exactly one implementation. A Python worker would have meant a
 * second copy of the ladder, and two copies of a rule like "four seconds of
 * silence is being stuck, not thinking" drift apart within a month.
 *
 * WIRING STATUS — read before trusting a score.
 *   Wired:      voice loop, turn detection, barge-in, ladder-driven prompting,
 *               text-level answer grading, the silence rescue.
 *   Not wired:  per-utterance audio capture feeding Speechace. `scoreUtterance`
 *               is called with the reference text and returns null without audio,
 *               and `grade()` treats a null score as "do not invent a penalty".
 *               So the session runs correctly today and simply reports no
 *               pronunciation focus until the audio tap is connected.
 */

import { fileURLToPath } from 'node:url';
import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  voice,
  llm,
} from '@livekit/agents';
import * as anthropic from '@livekit/agents-plugin-anthropic';
import * as openai from '@livekit/agents-plugin-openai';
import { DEFAULT_ROUTING } from '@parle/brain';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as silero from '@livekit/agents-plugin-silero';
import 'dotenv/config';

import { buildTTS } from './voice.ts';

import {
  CAFE_LESSON,
  createSession,
  currentPrompt,
  submitTurn,
  summarise,
  decodeClientMessage,
  encodeMessage,
  toLearnerInput,
  STUCK_SILENCE_MS,
  TOPIC_CLIENT,
  TOPIC_SERVER,
  type Lesson,
  type Rung,
  type ServerMessage,
  type SessionState,
} from '@parle/core';
import { buildPrompt } from './prompt.ts';
import { scoreUtterance } from './speechace.ts';
import { reportUsage } from './usage.ts';
import { ParleConversation, parseStoredProfile } from './convo.ts';

/** Anything that can carry a message back to the app. */
type Publisher = (message: ServerMessage) => void;

/**
 * The tutor brain, selected by env so the quality/cost trade is a .env change.
 *
 * `anthropic` — Claude, the production default. The scripted path is realtime
 *          speech, so it rides the same fast talker the conversation brain
 *          routes turns to (routing.ts). Coaching quality is the product;
 *          this is not the place to save a fraction of a cent.
 * `groq` — Llama 3.3 70B on Groq's free tier. $0, fast, genuinely decent
 *          French. The documented zero-budget fallback for key-less setups —
 *          its coaching is visibly weaker, which is why it stopped being the
 *          default.
 */
function tutorLLM() {
  const brain = process.env.TUTOR_LLM ?? 'anthropic';
  if (brain === 'groq') return openai.LLM.withGroq({ model: 'llama-3.3-70b-versatile' }); // reads GROQ_API_KEY
  return new anthropic.LLM({ model: DEFAULT_ROUTING.turn.model });
}

class ParleTutor extends voice.Agent {
  private state: SessionState;
  private silenceTimer?: ReturnType<typeof setTimeout>;
  // Not a constructor parameter property — Node runs this worker by stripping
  // types, and parameter properties emit runtime code, so they are rejected.
  private readonly lesson: Lesson;
  private publish: Publisher = () => {};
  private startedAt = Date.now();
  private ended = false;

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
    if (input) await this.applyInput(session, input);
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
  armRescue(session: voice.AgentSession): void {
    this.clearRescue();
    this.silenceTimer = setTimeout(() => {
      void this.applyInput(session, { type: 'silence', durationMs: STUCK_SILENCE_MS });
    }, STUCK_SILENCE_MS);
  }

  clearRescue(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = undefined;
  }

  /** The learner said something. Grade it, move the ladder, re-brief the tutor. */
  override async onUserTurnCompleted(_chatCtx: llm.ChatContext, newMessage: llm.ChatMessage): Promise<void> {
    this.clearRescue();
    const transcript = newMessage.textContent ?? '';
    if (!transcript.trim()) return;

    this.publish({ t: 'transcript', text: transcript, final: true });

    const prompt = currentPrompt(this.lesson, this.state);
    // Reference text is what makes accuracy scoring meaningful at all — see the
    // note in packages/core/src/lessons/types.ts.
    const phonemes = await scoreUtterance({ reference: prompt.turn.reference });

    await this.applyInput(this.session, {
      type: 'spoke',
      transcript,
      phonemes,
      durationSec: 0, // filled from audio metrics once the audio tap is wired
    });

    // applyInput generated the reply itself, under the interruption rules the
    // current rung demands. Cancel the pipeline's own automatic reply — it
    // would speak a second time, and with interruptions allowed, which is how
    // a speakerphone mic gets to cut the modelled line off mid-sentence.
    throw new voice.StopResponse();
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

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    // Loading the VAD model takes seconds; doing it per job would put that delay
    // in front of a learner who just tapped "speak".
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    const lesson = CAFE_LESSON;
    const voiceTts = buildTTS();

    // Connect before anything is built: the token server signs the lesson, the
    // opening rung and the session mode into the join credential, and the tutor
    // has to be constructed for where this learner actually left off — reading
    // the metadata after the fact would mean a session that already opened on
    // the wrong rung.
    await ctx.connect();
    const participant = await ctx.waitForParticipant();

    type TokenMeta = { lessonId?: string; startRung?: number; mode?: string; snapshot?: unknown };
    const parseMeta = (raw?: string): TokenMeta => {
      try {
        return raw ? (JSON.parse(raw) as TokenMeta) : {};
      } catch {
        // Malformed metadata is ignorable; identity alone is enough to debit.
        return {};
      }
    };

    const meta = parseMeta(participant.metadata);
    if (meta.lessonId && meta.lessonId !== lesson.id) {
      console.warn(`[parle] token metadata names lesson ${meta.lessonId}; agent is running ${lesson.id}`);
    }
    // Clamped, not trusted: the value is server-signed, but a rung outside the
    // ladder would still put createSession into a state that cannot exist.
    const startRung =
      typeof meta.startRung === 'number' && Number.isInteger(meta.startRung)
        ? (Math.min(4, Math.max(1, meta.startRung)) as Rung)
        : undefined;

    // Both session shapes share the whole voice pipeline below; only the agent
    // driving it differs. The convo profile is the app's stored brain profile,
    // riding the token as an opaque snapshot — tampering with it moves
    // pedagogy, never minutes.
    const tutor =
      meta.mode === 'convo' || meta.mode === 'convo-text'
        ? new ParleConversation(parseStoredProfile(meta.snapshot), { voiceless: meta.mode === 'convo-text' })
        : new ParleTutor(lesson, startRung);
    tutor.learnerId = participant.identity;

    // Safety net for reconnects and any learner who lands after the first: the
    // metered seconds must land on a real account whoever is in the room.
    const adoptLearner = (p: { identity: string; metadata?: string }) => {
      tutor.learnerId = p.identity;
      const late = parseMeta(p.metadata);
      if (late.lessonId && late.lessonId !== lesson.id) {
        console.warn(`[parle] token metadata names lesson ${late.lessonId}; agent is running ${lesson.id}`);
      }
    };
    ctx.room.on('participantConnected', (p) => adoptLearner(p));

    tutor.attach((message) => {
      void ctx.room.localParticipant
        ?.publishData(encodeMessage(message), { topic: TOPIC_SERVER, reliable: true })
        .catch((err) => console.error('[parle] failed to publish state', err));
    });

    ctx.room.on('dataReceived', (payload: Uint8Array, _participant, _kind, topic?: string) => {
      if (topic !== TOPIC_CLIENT) return;
      void tutor.handleClientMessage(session, payload);
    });

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      // Learner French is mangled French. Nova-3 with an explicit fr hint beats a
      // multilingual default; if measured WER on real beginner audio is still bad,
      // this is the first place to add a second model and reconcile.
      stt: new deepgram.STT({ model: 'nova-3', language: 'fr' }),
      llm: tutorLLM(),
      // Cached: scripted lesson lines are synthesized once, ever, and replayed
      // from disk. Only free-form replies reach the vendor. See ttsCache.ts.
      tts: voiceTts,
      turnHandling: {
        // Defaults (500ms, 0 words) let the tutor's own voice, picked up by a
        // speakerphone mic, cut the tutor off mid-sentence. Requiring real
        // duration plus STT-confirmed words kills those phantom barge-ins.
        interruption: { minDuration: 1200, minWords: 2 },
      },
    });

    session.on(voice.AgentSessionEventTypes.Error, (ev) => {
      // A TTS outage without this handler is indistinguishable from silence:
      // prompts keep flowing and the learner hears nothing. Tell them plainly.
      console.error('[parle] pipeline error:', ev.error);
      tutor.publishError('The tutor lost its voice for a moment. Give it a second, or leave and come back.');
    });

    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      // The tutor has stopped talking and is now waiting. Start the clock.
      if (ev.newState === 'listening') tutor.armRescue(session);
      if (ev.newState === 'speaking' || ev.newState === 'thinking') tutor.clearRescue();
      tutor.sendSpeaking(ev.newState === 'speaking');
    });

    session.on(voice.AgentSessionEventTypes.UserStateChanged, (ev) => {
      // They have started speaking — they are not stuck after all.
      if (ev.newState === 'speaking') tutor.clearRescue();
    });

    // A learner who closes the app still gets their minutes debited correctly.
    ctx.room.on('disconnected', () => {
      // Cost visibility per session: hits are free lines, misses were billed.
      console.log(`[parle] voice cache: ${voiceTts.hits} replayed free, ${voiceTts.misses} synthesized live`);
      void tutor.finish();
    });

    // The room 'disconnected' event is about the AGENT's own connection — when
    // the learner kills the app, the room stays up with the agent alone in it,
    // teaching nobody at full billing. End the session the moment they go.
    ctx.room.on('participantDisconnected', (p) => {
      if (p.identity === tutor.learnerId) void tutor.finish();
    });

    await session.start({ agent: tutor, room: ctx.room });

    if (tutor instanceof ParleConversation) {
      // The scene opens: the character speaks first and the app renders the
      // opening support. No model call — the frame carries everything.
      tutor.open(session);
    } else {
      tutor.sendCurrentPrompt();

      // The tutor opens. A beginner must never face a silent microphone and be
      // expected to start a conversation in a language they do not speak.
      session.generateReply(tutor.replyOptions());
    }
  },
});

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
