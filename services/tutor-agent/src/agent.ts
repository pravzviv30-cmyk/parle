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
 *               text-level answer grading, the silence rescue, per-utterance
 *               audio capture (utterance.ts) and the real spoken duration that
 *               comes with it.
 *   Behind a flag: sending that audio to Speechace. PARLE_AUDIO_SCORING=1 turns
 *               it on. Off, `scoreUtterance` is called with the reference alone
 *               and returns an empty array, `grade()` treats a null score as
 *               "do not invent a penalty", and the end card says plainly that
 *               nothing was scored rather than rendering a clean session.
 */

import { fileURLToPath } from 'node:url';
import {
  type JobContext,
  type JobProcess,
  WorkerOptions,
  cli,
  defineAgent,
  voice,
} from '@livekit/agents';
import * as anthropic from '@livekit/agents-plugin-anthropic';
import * as openai from '@livekit/agents-plugin-openai';
import { DEFAULT_ROUTING, defaultModel } from '@parle/brain';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as silero from '@livekit/agents-plugin-silero';
import { preflight, reportVendors, selectedBrain, verifyVendors } from './preflight.ts';
import 'dotenv/config';

import { buildTTS } from './voice.ts';

import {
  CAFE_LESSON,
  encodeMessage,
  TOPIC_CLIENT,
  TOPIC_SERVER,
  type Lesson,
  type Rung,
  type ServerMessage,
} from '@parle/core';
import { ParleConversation, parseStoredProfile, sttLanguageFor } from './convo.ts';
import { ParleTutor } from './tutor.ts';
import { createTurnTiming, formatTiming, mark } from './timing.ts';

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
 * `claude-cli` — a Claude subscription through the command line. It cannot
 *          reach this plugin at all (see below), so the scripted path resolves
 *          to Groq; only the conversation brain gets the subscription, and only
 *          for the calls that run after the room has closed.
 */
function tutorLLM() {
  // claude-cli lands here too, and on purpose. This is the LiveKit pipeline's
  // streaming LLM, not the brain's client: it is constructed by a plugin that
  // speaks HTTP to a vendor, and there is no shape of it that shells out to a
  // command line. A subscription cannot serve it, so the scripted lesson's
  // spoken replies stay on Groq while the conversation brain splits.
  if (selectedBrain() !== 'anthropic') return openai.LLM.withGroq({ model: 'llama-3.3-70b-versatile' }); // reads GROQ_API_KEY
  return new anthropic.LLM({ model: DEFAULT_ROUTING.turn.model });
}

export default defineAgent({
  prewarm: async (proc: JobProcess) => {
    // Loading the VAD model takes seconds; doing it per job would put that delay
    // in front of a learner who just tapped "speak".
    proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    const lesson = CAFE_LESSON;

    // Latency accounting: one record per turn, marked from the seams this file
    // already owns (session state changes, the TTS first-audio hook) and printed
    // when the tutor starts speaking. The brain marks belong to convo.ts and are
    // simply absent until wired there; formatTiming omits unmarked segments.
    let turnCount = 1;
    let timing = createTurnTiming(turnCount);

    const voiceTts = buildTTS({
      onFirstAudio: ({ hit }) => {
        mark(timing, 'firstAudio', performance.now());
        if (timing.cache === null) timing.cache = hit ? 'hit' : 'miss';
      },
    });

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
    const voiceless = meta.mode === 'convo-text' || meta.mode === 'lesson-text';
    const isConvo = meta.mode === 'convo' || meta.mode === 'convo-text';

    // Learner French is mangled French, and nova-3 with an explicit fr hint beats
    // a multilingual default at reading it. The one moment that is not true is a
    // conversation's opening question, which is asked in English and answered in
    // English — so a conversation starts multilingual and convo.ts retunes this
    // to French the moment the scene opens. See sttLanguageFor.
    const stt = new deepgram.STT({
      model: 'nova-3',
      language: sttLanguageFor(isConvo ? 'convo' : 'lesson', 'choosing'),
    });

    const tutor = isConvo
      ? new ParleConversation(parseStoredProfile(meta.snapshot), {
          voiceless,
          setSttLanguage: (language) => stt.updateOptions({ language }),
        })
      : new ParleTutor(lesson, startRung, { voiceless });
    tutor.learnerId = participant.identity;

    // The brain marks belong to the conversation; the record and the clock stay
    // here. Reading `timing` through the closure keeps marks landing on the
    // current turn's record across the per-turn resets below.
    if (tutor instanceof ParleConversation) {
      tutor.attachTiming((stage) => mark(timing, stage, performance.now()));
    }

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
      stt,
      llm: tutorLLM(),
      // Cached: scripted lesson lines are synthesized once, ever, and replayed
      // from disk. Only free-form replies reach the vendor. See ttsCache.ts.
      tts: voiceTts,
      turnHandling: {
        // Defaults (500ms, 0 words) let the tutor's own voice, picked up by a
        // speakerphone mic, cut the tutor off mid-sentence. Requiring real
        // duration plus STT-confirmed words kills those phantom barge-ins.
        interruption: { minDuration: 1200, minWords: 2 },
        // Pinned rather than defaulted: the framework floor is 500ms, or 300ms
        // when a streaming detector is in play, and 400ms is the chosen middle
        // ground between snappy replies and clipping slow finishes.
        endpointing: { minDelay: 400 },
        // The semantic turn detector reads the words to judge whether the
        // learner is done, which protects hesitating beginners from being cut
        // off mid-thought, so it stays the default. PARLE_TURN_DETECTION=vad
        // swaps in plain silence-based VAD turn taking for latency experiments.
        ...(process.env.PARLE_TURN_DETECTION === 'vad' ? { turnDetection: 'vad' as const } : {}),
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

      // The tutor's mouth opening closes the turn's books: print the line and
      // start the next record.
      if (ev.newState === 'speaking') {
        mark(timing, 'speaking', performance.now());
        console.log(formatTiming(timing));
        timing = createTurnTiming(++turnCount);
      }
    });

    session.on(voice.AgentSessionEventTypes.UserStateChanged, (ev) => {
      // They have started speaking — they are not stuck after all. This also
      // stands a rescue down that has already fired and is on its way; clearing
      // the timeout alone cannot, and both landing costs the learner a turn.
      if (ev.newState === 'speaking') tutor.setLearnerSpeaking(true);
      if (ev.newState === 'listening' || ev.newState === 'away') tutor.setLearnerSpeaking(false);

      // The learner falling silent is this turn's end of utterance, the moment
      // every later stage is measured against.
      if (ev.oldState === 'speaking' && ev.newState === 'listening') {
        mark(timing, 'eou', performance.now());
      }
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
      tutor.sendCurrentPrompt(session);

      // The tutor opens. A beginner must never face a silent microphone and be
      // expected to start a conversation in a language they do not speak. In a
      // typed lesson there is nothing to speak with: the published turn already
      // carries the tutor's line, the target and the support, and the model has
      // nothing to add to a script.
      if (!voiceless) session.generateReply(tutor.replyOptions());
    }
  },
});

// Before anything registers with LiveKit. A worker that cannot serve a turn
// must not advertise itself as able to — otherwise the first learner to arrive
// gets a room that opens and then stays silent.
preflight();

// Presence is not health. The keys can all be filled in and still be rejected,
// and the model named in one of them can have been retired since it was written
// — both of which land on the learner as that same silent room.
reportVendors(await verifyVendors(process.env, selectedBrain() === 'anthropic' ? '' : defaultModel()));

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
