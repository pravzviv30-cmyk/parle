/**
 * The tutor agent.
 *
 * A cascaded voice pipeline — Deepgram STT (fr) → Claude → ElevenLabs French TTS —
 * rather than a speech-to-speech model. Two reasons, both from the plan:
 * cost (a realtime model runs 2–4× the per-minute price) and control (we need the
 * learner's transcript and reference text in the loop to score pronunciation at
 * all, which a speech-to-speech model does not hand back).
 *
 * The important architectural decision is that this worker imports `@luvani/core`
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
 *   Behind a flag: sending that audio to Speechace. LUVANI_AUDIO_SCORING=1 turns
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
import { DEFAULT_OPENAI_TURN_MODEL, DEFAULT_ROUTING, defaultModel } from '@luvani/brain';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as silero from '@livekit/agents-plugin-silero';
import { preflight, reportVendors, selectedBrain, verifyVendors } from './preflight.ts';
import 'dotenv/config';

import { buildTTS, resolveTutorVoice } from './voice.ts';

import {
  CAFE_LESSON,
  encodeMessage,
  TOPIC_CLIENT,
  TOPIC_SERVER,
  tutorVoice,
  type Lesson,
  type Rung,
  type ServerMessage,
} from '@luvani/core';
import { LuvaniConversation, parseStoredProfile, sttLanguageFor, validSeedTopic } from './convo.ts';
import { LuvaniTutor } from './tutor.ts';
import { createTurnTiming, formatTiming, formatVendorMetrics, mark, type VendorMetrics } from './timing.ts';
import { turnHandlingFor } from './turnHandling.ts';

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
  if (selectedBrain() === 'openai') {
    return new openai.LLM({ model: process.env.OPENAI_TURN_MODEL?.trim() || DEFAULT_OPENAI_TURN_MODEL });
  }
  if (selectedBrain() !== 'anthropic') return openai.LLM.withGroq({ model: defaultModel() }); // reads GROQ_API_KEY
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

    // Connect before anything is built: the token server signs the lesson, the
    // opening rung and the session mode into the join credential, and the tutor
    // has to be constructed for where this learner actually left off — reading
    // the metadata after the fact would mean a session that already opened on
    // the wrong rung.
    await ctx.connect();
    const participant = await ctx.waitForParticipant();

    type TokenMeta = {
      sessionId?: unknown;
      secondsRemaining?: unknown;
      lessonId?: string;
      startRung?: number;
      mode?: string;
      snapshot?: unknown;
      seedTopic?: unknown;
      missionId?: unknown;
      tutorVoice?: unknown;
    };
    const parseMeta = (raw?: string): TokenMeta => {
      try {
        return raw ? (JSON.parse(raw) as TokenMeta) : {};
      } catch {
        // Malformed metadata is ignorable; identity alone is enough to debit.
        return {};
      }
    };

    const meta = parseMeta(participant.metadata);
    if (
      typeof meta.sessionId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(meta.sessionId)
    ) {
      throw new Error('signed join metadata is missing a valid session id');
    }
    if (meta.lessonId && meta.lessonId !== lesson.id) {
      console.warn(`[luvani] token metadata names lesson ${meta.lessonId}; agent is running ${lesson.id}`);
    }
    const allowanceRemaining =
      typeof meta.secondsRemaining === 'number' && Number.isFinite(meta.secondsRemaining)
        ? Math.max(1, Math.floor(meta.secondsRemaining))
        : 15 * 60;
    const maximumSessionSec = Math.min(15 * 60, allowanceRemaining);
    // Clamped, not trusted: the value is server-signed, but a rung outside the
    // ladder would still put createSession into a state that cannot exist.
    const startRung =
      typeof meta.startRung === 'number' && Number.isInteger(meta.startRung)
        ? (Math.min(4, Math.max(1, meta.startRung)) as Rung)
        : undefined;

    // Who the learner chose to be taught by, and the one place that choice is
    // settled. `resolveTutorVoice` returns a catalogue key or the default and
    // never throws, which matters twice over: this worker holds the only
    // ElevenLabs key in the system, so whatever comes out of here becomes a
    // path segment in a request somebody pays for; and the room is already
    // open, so a voice we retired last month has to become a lesson in Luc's
    // voice rather than an exception into a silence the learner is paying for.
    //
    // The token server signs this value but deliberately only shape-checks it
    // (F284). A signature proves who sent it, never that the voice exists.
    const chosenVoice = resolveTutorVoice(meta.tutorVoice);

    // BUILT HERE, AND NOT ONE LINE EARLIER. This call used to sit above
    // ctx.connect(), which was correct for exactly as long as the voice was a
    // constant: the moment it belongs to a learner, building the TTS before
    // waitForParticipant means choosing the voice before knowing whose session
    // it is. Nothing about that reads as a bug at the call site — every voice
    // test still passes and every learner quietly hears the default. The
    // joinMeta tripwire holds this ordering for that reason.
    //
    // The cost of moving it: a missing or refused vendor key now throws after
    // the room is open instead of before. Preflight already refuses to register
    // a worker whose voice key is absent, so the case this trades away is one
    // the worker would not have been running in.
    const voiceTts = buildTTS({
      voice: chosenVoice,
      onFirstAudio: ({ hit }) => {
        mark(timing, 'firstAudio', performance.now());
        if (timing.cache === null) timing.cache = hit ? 'hit' : 'miss';
      },
    });

    // The person that voice belongs to. Name and pronoun travel together out of
    // core's catalogue, in one row, so they cannot drift: two of the eight
    // voices are women, and a hardcoded "Luc, he" would have Céline introduce
    // herself as a man in her first sentence. The prompts do not get to decide
    // this, and neither does this file — it reads the row and passes it on.
    const persona = tutorVoice(chosenVoice).persona;

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

    // A topic the learner tapped in Practice, so the conversation opens on it
    // rather than asking what to talk about. Checked again here for the same
    // reason as the rung above: the value is server-signed, but the shape
    // inside it came from the app, and this one ends up in a spoken line.
    // Meaningful only for a conversation — the scripted lesson has a script,
    // and nothing for a seed to steer.
    const seedTopic = validSeedTopic(meta.seedTopic);

    // The mission the learner tapped. Same channel as the seed topic and the
    // same reasoning about trust: server-signed, but the shape inside came from
    // the app, so `LuvaniConversation` resolves it against the frames it
    // actually has and opens the ordinary choosing question for anything else.
    //
    // Reading it here is what makes the whole authored-scene path exist. The
    // token server signs it and the conversation accepts it, and for a while
    // this line was missing between them, so every mission tap still paid the
    // ten-to-twenty-five second scene build and no test could see it: the
    // mission tests all build LuvaniConversation directly and never come
    // through this door.
    const missionId = meta.missionId;

    const tutor = isConvo
      ? new LuvaniConversation(parseStoredProfile(meta.snapshot), {
          voiceless,
          seedTopic,
          missionId,
          // The same clamped rung the scripted lesson below already got, now
          // reaching the branch a mission actually runs on. It rode this far
          // and then died here: missions are conversations, so handing it only
          // to LuvaniTutor meant a learner replaying a finished mission got
          // exactly the help they had last time, with every wire in between
          // looking connected. LuvaniConversation reads it when it opens a
          // mission and nowhere else.
          startRung,
          persona,
          setSttLanguage: (language) => stt.updateOptions({ language }),
        })
      : new LuvaniTutor(lesson, startRung, { voiceless, persona });
    tutor.learnerId = participant.identity;
    tutor.sessionId = meta.sessionId;

    // Join-token expiry only limits replay; it does not eject a connected
    // participant. This timer is the actual vendor-cost and allowance ceiling.
    const hardStop = setTimeout(() => {
      tutor.publishError('That is a good place to stop. Your session has reached its time limit.');
      void tutor.finish().finally(() => ctx.room.disconnect());
    }, maximumSessionSec * 1_000);

    // The brain marks belong to the conversation; the record and the clock stay
    // here. Reading `timing` through the closure keeps marks landing on the
    // current turn's record across the per-turn resets below.
    if (tutor instanceof LuvaniConversation) {
      tutor.attachTiming((stage) => mark(timing, stage, performance.now()));
    }

    // The first verified participant owns this tutor for its whole lifetime.
    // A later room participant must never be able to redirect usage or data to
    // another account by becoming "the latest" identity.
    ctx.room.on('participantConnected', (p) => {
      if (p.identity !== tutor.learnerId) {
        console.warn('[luvani] ignored an unexpected participant in a learner-bound room');
      }
    });

    // The one channel back to the app. The tutor's frames go down it, and so do
    // the worker's own.
    //
    // The promise is returned rather than dropped: `publishData` settles when
    // the frame has actually left, and a safety stop waits for that before the
    // room closes. In a typed session nothing is spoken, so the reliable data
    // frame is the only delivery there is, and disconnecting a tick early would
    // take the crisis line with it.
    const publish = (message: ServerMessage) =>
      ctx.room.localParticipant
        ?.publishData(encodeMessage(message), { topic: TOPIC_SERVER, reliable: true })
        .catch((err) => console.error('[luvani] failed to publish state', err));

    tutor.attach(publish);

    // A stop ends the session, and the room is the worker's to close — the same
    // division as the hard stop above and the learner who walks away below. The
    // tutor owns the judgement that this is over; it disconnects nothing itself.
    tutor.attachRoomClose(() => {
      clearTimeout(hardStop);
      void ctx.room.disconnect();
    });

    ctx.room.on('dataReceived', (payload: Uint8Array, source, _kind, topic?: string) => {
      if (topic !== TOPIC_CLIENT) return;
      if (!source || source.identity !== tutor.learnerId) return;
      // The belt to handleClientMessage's braces. It contains its own failures,
      // so this should never fire — but this worker serves every learner on the
      // process, and an unhandled rejection here ends all of their sessions at
      // once. A `void` with no catch is that bet, taken on every frame.
      void tutor.handleClientMessage(session, payload).catch((err: unknown) => {
        console.error('[luvani] a client message failed on its way in', err);
      });
    });

    const session = new voice.AgentSession({
      vad: ctx.proc.userData.vad as silero.VAD,
      stt,
      llm: tutorLLM(),
      // Cached: scripted lesson lines are synthesized once, ever, and replayed
      // from disk. Only free-form replies reach the vendor. See ttsCache.ts.
      tts: voiceTts,
      // Every one of these is a decision with a learner on the other end of it,
      // so they live in a tested module rather than inline here. See
      // turnHandling.ts for what each one costs when it is wrong.
      turnHandling: turnHandlingFor(isConvo ? 'convo' : 'lesson', {
        turnDetection: process.env.LUVANI_TURN_DETECTION,
      }),
    });

    session.on(voice.AgentSessionEventTypes.Error, (ev) => {
      // A TTS outage without this handler is indistinguishable from silence:
      // prompts keep flowing and the learner hears nothing. Tell them plainly.
      console.error('[luvani] pipeline error:', ev.error);

      // Which half broke, and whether it is coming back. Every arm of the
      // pipeline's error union already carries both (events.ts: STTError,
      // TTSError, LLMError, RealtimeModelError, InterruptionDetectionError), so
      // this is the field itself and not a translation table — a sixth kind the
      // SDK learns fails to compile here rather than arriving as a silent
      // miscategorisation of one of the five.
      //
      // Passing them on is the whole fix. One sentence used to answer for all
      // five, and a Deepgram outage told the learner the tutor's VOICE had gone
      // when what it had lost was its ears: they kept talking to something that
      // could not hear them while the meter ran. The agent does not decide what
      // that reads as; it reports what the vendor said and the app names it
      // (classifyPipelineError in apps/mobile/src/live/failure.ts).
      const kind = ev.error.type;
      const recoverable = ev.error.recoverable;

      // The line somebody greps at two in the morning. `TUTOR_PIPELINE_DOWN` is
      // an interface, not a log message: a vendor half of the tutor is down and
      // not coming back on its own. The prefixes are repeated from failure.ts
      // rather than imported, because that file reaches for livekit-client and
      // a browser SDK has no business inside the worker.
      //
      // What goes in: what broke, whether it is coming back, and which kind of
      // session it happened in. What never goes in: the frame's sentence, and
      // anything the learner said. The vendor's own error is logged above, on
      // its own line, so this one stays clean enough to paste anywhere.
      const prefix = recoverable ? '[luvani:live] pipeline' : '[luvani] TUTOR_PIPELINE_DOWN';
      console.error(
        `${prefix} kind=${kind} recoverable=${recoverable ? 'yes' : 'no'} mode=${voiceless ? 'typed' : 'spoken'}`,
      );

      // The sentence stays what it has always been. With `kind` on the frame the
      // app never renders it, and an app that predates the field still shows the
      // notice it shows today rather than a new string it was never tested with.
      void publish({
        t: 'error',
        message: 'The tutor lost its voice for a moment. Give it a second, or leave and come back.',
        kind,
        recoverable,
      });
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

    // The pipeline measures the vendors Luvani was guessing about: time to the
    // voice vendor's first byte, how long the recogniser took after the learner
    // stopped, how long the turn decision itself ran. It has been emitting all
    // of it to nobody. An `llm` line during a CONVERSATION is a finding in its
    // own right: that model is told it is unused, so anything it reports was
    // speculative, billed and thrown away.
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      const line = formatVendorMetrics(ev.metrics as VendorMetrics);
      if (line !== null) console.log(line);
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
      clearTimeout(hardStop);
      // Cost visibility per session: hits are free lines, misses were billed.
      console.log(`[luvani] voice cache: ${voiceTts.hits} replayed free, ${voiceTts.misses} synthesized live`);
      void tutor.finish();
    });

    // The room 'disconnected' event is about the AGENT's own connection — when
    // the learner kills the app, the room stays up with the agent alone in it,
    // teaching nobody at full billing. End the session the moment they go.
    ctx.room.on('participantDisconnected', (p) => {
      if (p.identity === tutor.learnerId) {
        clearTimeout(hardStop);
        void tutor.finish().finally(() => ctx.room.disconnect());
      }
    });

    await session.start({ agent: tutor, room: ctx.room });

    if (tutor instanceof LuvaniConversation) {
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
reportVendors(await verifyVendors(process.env, selectedBrain() === 'groq' ? defaultModel() : ''));

cli.runApp(new WorkerOptions({ agent: fileURLToPath(import.meta.url) }));
