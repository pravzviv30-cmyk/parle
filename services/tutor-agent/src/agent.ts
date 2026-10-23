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
 *   Behind a flag: sending that audio to the pronunciation vendor (TonePerfect
 *               by default; see services/shared/pronunciation.ts).
 *               LUVANI_AUDIO_SCORING=1 turns it on, and by the founder's
 *               decision of 2026-09-29 it stays off until scoring runs off the
 *               reply path (F623). Off, `scoreUtterance` is called with the
 *               reference alone and returns an empty array, `grade()` treats a
 *               null score as "do not invent a penalty", and the end card says
 *               plainly that nothing was scored rather than rendering a clean
 *               session.
 */

import { correctionReasonReaderFromEnv } from './correctionReason.ts';
import { canDoEvidenceReaderFromEnv } from './canDoEvidence.ts';
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
import { brainClientFromEnv, openAiLiveModel, DEFAULT_ROUTING, defaultModel } from '@luvani/brain';
import * as deepgram from '@livekit/agents-plugin-deepgram';
import * as silero from '@livekit/agents-plugin-silero';
import { preflight, reportVendors, selectedBrain, verifyVendors } from './preflight.ts';
import 'dotenv/config';
import { sessionAudio, supportsSessionMode, typedOnly } from '../../shared/sessionCapabilities.ts';

import { buildTTS, resolveTutorVoice } from './voice.ts';
import { formatCostLine } from './ttsCache.ts';
import { resumePaidRuntime } from './paidRuntime.ts';
import { createPaidVoiceProxy, type PaidVoiceProxy } from './paidVoiceProxy.ts';
import { admitGuestRoom, armSceneHardStop, createGuestSceneGate, sceneLesson } from './guestSceneGate.ts';
import { ELEVEN_VOICES, MODEL as TTS_MODEL } from './voiceConfiguration.ts';

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
import { LuvaniConversation, memoryLockedFrom, parseStoredProfile, sttLanguageFor, validSeedTopic } from './convo.ts';
import { recognitionPlan } from './recognitionPlan.ts';
import { LuvaniTutor } from './tutor.ts';
import { formatVendorMetrics, type VendorMetrics } from './timing.ts';
import { createInputReplyTiming, createSceneReplyTiming } from './sceneReplyTiming.ts';
import { turnHandlingFor } from './turnHandling.ts';
import { reportUsage } from './usage.ts';
import { safeError } from './safeError.ts';
import { claimSessionLifecycle, legacyRuntimeFixture, tutorSupervisorHeartbeat, type TutorSessionIdentity } from './sessionLifecycle.ts';

// SDK session-end and shutdown each join the same idempotent completion.
const completions = new WeakMap<JobContext, () => Promise<void>>();

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
function tutorLLM(proxy?: PaidVoiceProxy) {
  // claude-cli lands here too, and on purpose. This is the LiveKit pipeline's
  // streaming LLM, not the brain's client: it is constructed by a plugin that
  // speaks HTTP to a vendor, and there is no shape of it that shells out to a
  // command line. A subscription cannot serve it, so the scripted lesson's
  // spoken replies stay on Groq while the conversation brain splits.
  if (selectedBrain() === 'openai') {
    const model = new openai.LLM({ model: openAiLiveModel(), ...(proxy ? { baseURL: proxy.openaiBaseURL, apiKey: 'proxy-only', maxCompletionTokens: 3000 } : {}) });
    if (proxy) model.prewarm = () => {};
    return model;
  }
  if (selectedBrain() !== 'anthropic') return openai.LLM.withGroq({ model: defaultModel() }); // reads GROQ_API_KEY
  const model = new anthropic.LLM({ model: DEFAULT_ROUTING.turn.model, ...(proxy ? { baseURL: proxy.anthropicBaseURL, apiKey: 'proxy-only', maxTokens: 3000, maxRetries: 0 } : {}) });
  if (proxy) model.prewarm = () => {};
  return model;
}

export default defineAgent({
  onSessionEnd: async (ctx: JobContext) => { await completions.get(ctx)?.(); },
  prewarm: async (proc: JobProcess) => {
    // Loading the VAD model takes seconds; doing it per job would put that delay
    // in front of a learner who just tapped "speak".
    if (!typedOnly()) proc.userData.vad = await silero.VAD.load();
  },

  entry: async (ctx: JobContext) => {
    // Confirmed spoken scene inputs own their records. Untagged TTS frames and
    // speaking-state transitions are not evidence of this reply's first audio.
    const sceneTiming = createSceneReplyTiming(() => performance.now());
    const inputTiming = process.env.LUVANI_REPLY_STAGE_TIMING === '1'
      ? createInputReplyTiming(() => performance.now(), line => console.log(line)) : undefined;

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
      revision?: unknown;
      missionId?: unknown;
      tutorVoice?: unknown;
      lifecycleVersion?: unknown;
      guestLifecycleKey?: unknown;
      firstPractice?: unknown;
      /** Signed `'guest-cafe'` on a guest first scene. It alone selects the scene; lessonId never does. */
      scene?: unknown;
      /** Signed `true` for a free or lapsed learner: no tutor memory is read or written. Absent on paid sessions. */
      memoryLocked?: unknown;
    };
    const parseMeta = (raw?: string): TokenMeta => {
      try {
        const value: unknown = raw ? JSON.parse(raw) : {};
        return value && typeof value === 'object' && !Array.isArray(value) ? value as TokenMeta : {};
      } catch {
        // Admission below refuses missing or malformed signed bindings.
        return {};
      }
    };

    const meta = parseMeta(participant.metadata);
    if (
      typeof meta.sessionId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(meta.sessionId)
    ) {
      throw new Error('signed join metadata is missing a valid session id');
    }
    if (!['lesson', 'lesson-text', 'convo', 'convo-text'].includes(meta.mode ?? '')) throw new Error('invalid signed session mode');
    // Every guest and scene rule, decided before any claim or vendor work.
    const room = admitGuestRoom(meta, process.env);
    const { guestKey, scene, firstPractice } = room;
    const lesson = scene ? sceneLesson(scene) : CAFE_LESSON;
    if (meta.lessonId && meta.lessonId !== lesson.id) {
      console.warn('[luvani] signed lesson differs from the worker catalogue');
    }
    const fixture = meta.lifecycleVersion !== 1 && legacyRuntimeFixture(process.env);
    if (meta.lifecycleVersion !== 1 && !fixture) throw new Error('authoritative signed tutor lifecycle is required');
    const lifecycle = fixture ? undefined : await claimSessionLifecycle({
      userId: participant.identity, sessionId: meta.sessionId, roomName: ctx.room.name ?? '',
      mode: meta.mode as TutorSessionIdentity['mode'],
    }, guestKey ? { guestKey, ...(scene ? { scene: true } : {}) } : {});
    let proxy: PaidVoiceProxy | undefined;
    const closeProxy = async () => { await proxy?.close(); };
    let stopPaidWork = () => { void closeProxy().catch(() => {}); };
    let finish = async (): Promise<void> => { if (lifecycle) await lifecycle.complete({ learnerTurns: 0 }); };
    completions.set(ctx, () => finish());
    ctx.addShutdownCallback(async () => { stopPaidWork(); await closeProxy(); await finish(); });
    lifecycle?.onStop(() => {
      stopPaidWork();
      // Disconnect now: settlement retries must not keep STT/TTS spending.
      void ctx.room.disconnect().catch(() => {});
      void finish().catch(() => {});
    });
    try {
    if (!supportsSessionMode(meta.mode ?? 'lesson')) {
      // A directly deployed mismatched token process may already have granted
      // this signed room. Nothing ran; close its lease with zero usage before
      // refusing it. This does not reverse an already claimed trial.
      if (lifecycle) await finish();
      else await reportUsage({ userId: participant.identity, sessionId: meta.sessionId, seconds: 0, utterancesScored: 0 });
      throw new Error('This worker supports typed sessions only.');
    }
    const voiceless = meta.mode === 'convo-text' || meta.mode === 'lesson-text';
    const isConvo = meta.mode === 'convo' || meta.mode === 'convo-text';
    const allowanceRemaining =
      typeof meta.secondsRemaining === 'number' && Number.isFinite(meta.secondsRemaining)
        ? Math.max(1, Math.floor(meta.secondsRemaining))
        : 15 * 60;
    const maximumSessionSec = lifecycle?.maxSeconds ?? Math.min(15 * 60, allowanceRemaining);
    // A scene never resumes paid admission: a guest has no account to admit.
    const paid = process.env.NODE_ENV === 'production' && lifecycle && !scene ? await resumePaidRuntime(lifecycle) : undefined;
    if (paid && lifecycle) proxy = await createPaidVoiceProxy({ gate: paid.gate, signal: lifecycle.signal, maximumSessionMillis: maximumSessionSec * 1000, credentials: { deepgram: process.env.DEEPGRAM_API_KEY, elevenlabs: process.env.ELEVEN_API_KEY, anthropic: process.env.ANTHROPIC_API_KEY, openai: process.env.OPENAI_API_KEY } });
    if (scene && process.env.NODE_ENV === 'production') {
      // Fails closed unless this is a guest-bound lifecycle with no paid admission.
      if (!lifecycle) throw new Error('guest scene lifecycle unavailable');
      const sceneGate = createGuestSceneGate({ guestKey, paid, voiceId: ELEVEN_VOICES[resolveTutorVoice(meta.tutorVoice)], model: TTS_MODEL, signal: lifecycle.signal });
      // Only the two voice keys reach this proxy; no model key is handed over.
      proxy = await createPaidVoiceProxy({ gate: sceneGate.gate, speechAllowList: sceneGate.admitsText, signal: lifecycle.signal, maximumSessionMillis: maximumSessionSec * 1000, credentials: { deepgram: process.env.DEEPGRAM_API_KEY, elevenlabs: process.env.ELEVEN_API_KEY } });
    }
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
    // a spoken worker whose voice key is absent, so the case this trades away is one
    // the worker would not have been running in.
    lifecycle?.assertActive();
    const persona = tutorVoice(chosenVoice).persona;
    const recognition = recognitionPlan(isConvo ? 'convo' : 'lesson', sttLanguageFor(isConvo ? 'convo' : 'lesson', 'choosing'), process.env);
    const { vad, stt, tts: voiceTts } = sessionAudio(voiceless, {
      vad: () => ctx.proc.userData.vad as silero.VAD,
      stt: () => recognition.experimental
        ? new deepgram.STTv2(recognition.options)
        : new deepgram.STT({ ...recognition.options, ...(proxy ? { baseUrl: proxy.deepgramBaseURL, apiKey: 'proxy-only', sampleRate: 16000, numChannels: 1, mipOptOut: true } : {}) }),
      tts: () => buildTTS({
        voice: chosenVoice,
        ...(proxy ? { baseURL: proxy.elevenlabsBaseURL, missTransport: 'http' as const } : {}),
      }),
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
    const reviewFocus = typeof meta.snapshot === 'object' && meta.snapshot !== null
      ? (meta.snapshot as { reviewFocus?: unknown }).reviewFocus : undefined;
    const previousCorrection = typeof meta.snapshot === 'object' && meta.snapshot !== null
      ? (meta.snapshot as { previousCorrection?: unknown }).previousCorrection : undefined;

    const tutor = isConvo
      ? new LuvaniConversation(parseStoredProfile(meta.snapshot), {
          voiceless,
          // Strict: only a signed boolean `true` locks memory; anything else is a paid session.
          memoryLocked: memoryLockedFrom(meta.memoryLocked),
          seedTopic,
          firstPractice,
          revision: meta.revision,
          reviewFocus,
          previousCorrection,
          missionId,
          canDoEvidenceReader: paid ? undefined : canDoEvidenceReaderFromEnv(),
          correctionReasonReader: paid ? undefined : correctionReasonReaderFromEnv(),
          // The same clamped rung the scripted lesson below already got, now
          // reaching the branch a mission actually runs on. It rode this far
          // and then died here: missions are conversations, so handing it only
          // to LuvaniTutor meant a learner replaying a finished mission got
          // exactly the help they had last time, with every wire in between
          // looking connected. LuvaniConversation reads it when it opens a
          // mission and nowhere else.
          startRung,
          persona,
          enrichBeforeComplete: !!paid,
          ...(paid ? { client: brainClientFromEnv(process.env, paid.transport), scoringRequest: paid.transport } : {}),
          setSttLanguage: (language) => {
            if (recognition.experimental || !stt) return;
            stt.updateOptions({ language });
            // Retuning the model config alone leaves its existing stream in
            // the old language. The public agent update restarts recognition
            // from the configured STT at the scene boundary. The SDK handles
            // an agent that has already stopped; never leave a rejection loose.
            void tutor.updateOptions({ stt }).catch((error: unknown) => {
              console.error('[luvani] recognition language could not be updated:', safeError(error));
              tutor.publishError('Speech recognition could not update. You can continue by typing.');
            });
          },
          // The public session API updates the active stream, deduplicates
          // keyterms and defers reconnecting while the learner is speaking.
          // STT.updateOptions only configures future streams in SDK 1.9.
          // Paid proxy configuration is quote-bound; do not change it here.
          setSttPhrases: (keyterms) => {
            if (!recognition.experimental && !proxy) session.updateOptions({ keyterms });
          },
        })
      : scene
        ? new LuvaniTutor(lesson, undefined, { voiceless, persona, scriptOnly: true, scene: true })
        : new LuvaniTutor(lesson, startRung, { voiceless, persona, ...(paid ? { scoringRequest: paid.transport } : {}) });
    tutor.learnerId = participant.identity;
    tutor.sessionId = meta.sessionId;
    if (lifecycle) tutor.attachLifecycle(lifecycle);
    finish = async () => { stopPaidWork(); await closeProxy(); await tutor.finish(); };
    stopPaidWork = () => {
      void closeProxy().catch(() => {});
      tutor.cancelLiveReplies();
      if (tutor instanceof LuvaniConversation) tutor.cancelCanDoEvidence();
    };
    lifecycle?.assertActive();

    // Join-token expiry only limits replay; it does not eject a connected
    // participant. This timer is the actual vendor-cost and allowance ceiling.
    const hardStop = lifecycle ? undefined : setTimeout(() => {
      tutor.publishError('That is a good place to stop. Your session has reached its time limit.');
      if (tutor instanceof LuvaniConversation) { tutor.cancelCanDoEvidence(); tutor.cancelLiveReplies(); }
      void tutor.finish().finally(() => ctx.room.disconnect());
    }, maximumSessionSec * 1_000);
    // A scene's own ceiling: disconnects at its limit even if settlement never answers.
    const cancelSceneStop = scene && lifecycle ? armSceneHardStop({
      remainingMillis: (lifecycle.maxSeconds - lifecycle.elapsedSeconds()) * 1_000,
      stopPaidWork: () => stopPaidWork(),
      notify: () => tutor.publishError('That is a good place to stop. Your session has reached its time limit.'),
      settle: () => tutor.finish(),
      disconnect: () => ctx.room.disconnect(),
    }) : () => {};

    // Capture before queueing so a later input cannot replace an earlier EOU.
    if (tutor instanceof LuvaniConversation) {
      tutor.attachReplyTiming((eligible) => sceneTiming.begin(eligible), () => sceneTiming.invalidate());
      if (inputTiming) tutor.attachInputReplyTiming(input => inputTiming.begin(input));
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
        .catch((err) => console.error('[luvani] failed to publish state', safeError(err)));

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
        console.error('[luvani] a client message failed on its way in', safeError(err));
      });
    });

    const session = new voice.AgentSession({
      vad,
      stt,
      // A scene builds no model client at all.
      llm: scene ? undefined : tutorLLM(proxy),
      ...(paid || scene ? { connOptions: { sttConnOptions: { maxRetry: 0 }, llmConnOptions: { maxRetry: 0 }, ttsConnOptions: { maxRetry: 0 }, maxUnrecoverableErrors: 1 } } : {}),
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
    session.on(voice.AgentSessionEventTypes.Close, () => { stopPaidWork(); void finish().catch(() => {}); });

    session.on(voice.AgentSessionEventTypes.Error, (ev) => {
      // A TTS outage without this handler is indistinguishable from silence:
      // prompts keep flowing and the learner hears nothing. Tell them plainly.
      console.error('[luvani] pipeline error:', safeError(ev.error));

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
      const learnerPresent = [...ctx.room.remoteParticipants.values()].some(p => p.identity === tutor.learnerId);
      const serviceFailure = tutor.terminalFailureFor(kind, recoverable, learnerPresent);

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
      void Promise.resolve().then(() => publish({
        t: 'error',
        message: 'The tutor lost its voice for a moment. Give it a second, or leave and come back.',
        kind,
        recoverable,
        ...(serviceFailure ? { terminal: true } : {}),
      })).finally(() => {
        if (!serviceFailure) return;
        clearTimeout(hardStop);
        if (tutor instanceof LuvaniConversation) { tutor.cancelCanDoEvidence(); tutor.cancelLiveReplies(); }
        return tutor.finish().finally(() => ctx.room.disconnect());
      }).catch(() => {});
    });

    session.on(voice.AgentSessionEventTypes.AgentStateChanged, (ev) => {
      // The tutor has stopped talking and is now waiting. Start the clock.
      if (ev.newState === 'listening') tutor.armRescue(session);
      if (ev.newState === 'speaking' || ev.newState === 'thinking') tutor.clearRescue();
      tutor.sendSpeaking(ev.newState === 'speaking');

    });

    // The pipeline measures the vendors Luvani was guessing about: time to the
    // voice vendor's first byte, how long the recogniser took after the learner
    // stopped, how long the turn decision itself ran. It has been emitting all
    // of it to nobody. An `llm` line during a CONVERSATION is a finding in its
    // own right: that model is told it is unused, so anything it reports was
    // speculative, billed and thrown away.
    // Seconds of learner audio the recogniser was fed, summed from the vendor's
    // own usage reports (Deepgram flushes one every five seconds of audio and
    // at stream end). Feeds sttSec on the [luvani:cost] line.
    let sttAudioMs = 0;
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      const m = ev.metrics as VendorMetrics;
      if (m.type === 'stt_metrics' && typeof m.audioDurationMs === 'number') sttAudioMs += m.audioDurationMs;
      const line = formatVendorMetrics(m);
      if (line !== null) console.log(line);
    });

    session.on(voice.AgentSessionEventTypes.UserStateChanged, (ev) => {
      // They have started speaking — they are not stuck after all. This also
      // stands a rescue down that has already fired and is on its way; clearing
      // the timeout alone cannot, and both landing costs the learner a turn.
      if (ev.newState === 'speaking') {
        sceneTiming.speechStarted();
        tutor.setLearnerSpeaking(true);
      }
      if (ev.newState === 'listening' || ev.newState === 'away') tutor.setLearnerSpeaking(false);

      // The learner falling silent is this turn's end of utterance, the moment
      // every later stage is measured against.
      if (ev.oldState === 'speaking' && ev.newState === 'listening') {
        sceneTiming.speechEnded(performance.now());
      }
    });

    // A learner who closes the app still gets their minutes debited correctly.
    ctx.room.on('disconnected', () => {
      clearTimeout(hardStop); cancelSceneStop();
      if (tutor instanceof LuvaniConversation) {
        console.log(sceneTiming.close());
        for (const line of inputTiming?.close() ?? []) console.log(line);
        if (process.env.LUVANI_REPLY_FIRST_FRAME_TIMING === '1') console.log(sceneTiming.audioFormat());
      }
      // Cost visibility per session: hits are free lines, misses were billed.
      if (voiceTts) console.log(`[luvani] voice cache: ${voiceTts.hits} replayed free, ${voiceTts.misses} synthesized live`);
      // Numbers only, joined to [luvani:brain:summary] by the session prefix.
      console.log(formatCostLine({ sessionId: tutor.sessionId, tts: voiceTts, sttSec: stt ? sttAudioMs / 1000 : null }));
      voiceTts?.clearReplayMemo();
      if (tutor instanceof LuvaniConversation) { tutor.cancelCanDoEvidence(); tutor.cancelLiveReplies(); }
      stopPaidWork();
      void finish().catch(() => {});
    });

    // The room 'disconnected' event is about the AGENT's own connection — when
    // the learner kills the app, the room stays up with the agent alone in it,
    // teaching nobody at full billing. End the session the moment they go.
    ctx.room.on('participantDisconnected', (p) => {
      if (p.identity === tutor.learnerId) {
        clearTimeout(hardStop);
        // Recognition stops with the learner, not after settlement.
        stopPaidWork();
        if (tutor instanceof LuvaniConversation) { tutor.cancelCanDoEvidence(); tutor.cancelLiveReplies(); }
        return tutor.finish().finally(() => ctx.room.disconnect());
      }
    });

    // Learning artefacts are saved explicitly; do not upload raw session audio,
    // transcripts, logs or traces through the SDK's default cloud recorder.
    // Input is bound to the signed participant, so a second participant's
    // audio or text never reaches this session.
    await session.start({ agent: tutor, room: ctx.room, record: false,
      ...(voiceless ? { inputOptions: { audioEnabled: false }, outputOptions: { audioEnabled: false } } : {}),
      // Overrides the typed-mode inputOptions above while keeping audio off there.
      inputOptions: { participantIdentity: participant.identity, ...(voiceless ? { audioEnabled: false } : {}) },
    });
    lifecycle?.assertActive();

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
      // nothing to add to a script. Spoken from the script for the same reason.
      if (!voiceless) tutor.speakCurrentTurn(session);
    }
    } catch (error) {
      stopPaidWork();
      await finish();
      await ctx.room.disconnect().catch(() => {});
      throw error;
    }
  },
});

// The worker runs this file directly (`node src/agent.ts dev`), so its entry
// script is this module. Every job the worker takes is a fresh process that the
// framework starts from its own entry script and which then imports this module
// again, so everything at the top level here runs once per session as well.
// The checks below belong to the worker alone: a job that re-asked three vendors
// before it could answer gated the tutor's arrival on their latency, and on a
// slow day overran the framework's ten-second start-up allowance, so every room
// opened and stayed silent (F384).
const isWorkerProcess = process.argv[1] === fileURLToPath(import.meta.url);

if (isWorkerProcess) {
  // Before anything registers with LiveKit. A worker that cannot serve a turn
  // must not advertise itself as able to — otherwise the first learner to arrive
  // gets a room that opens and then stays silent.
  preflight();

  // Presence is not health. The keys can all be filled in and still be rejected,
  // and the model named in one of them can have been retired since it was written
  // — both of which land on the learner as that same silent room.
  if (process.env.NODE_ENV !== 'production') reportVendors(await verifyVendors(process.env, ['groq', 'claude-cli', 'claude-cli-all'].includes(selectedBrain()) ? defaultModel() : ''));
  // Production vendor acceptance is a reviewed paid canary, never a billable boot probe.
}

const workerOptions = new WorkerOptions({ agent: fileURLToPath(import.meta.url), production: process.argv.includes('start') });
if (isWorkerProcess && workerOptions.production && !process.argv.includes('--simulation')) {
  // This is the SDK's actual configured health port. Its '/' reports 200 only
  // after registration/connection and inference health, never at process start.
  const heartbeat = tutorSupervisorHeartbeat({ port: workerOptions.port });
  void heartbeat.poll();
  process.once('SIGTERM', () => { void heartbeat.drain(); });
  process.once('SIGINT', () => { void heartbeat.drain(); });
}
cli.runApp(workerOptions);
