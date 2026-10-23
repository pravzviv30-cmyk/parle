/**
 * The guest first scene: who may open one, what it may say, and what it may spend.
 *
 * A guest has no account, so there is no SQL paid admission to resume. In
 * production this module's gate stands in for `resumePaidRuntime` as the gate
 * handed to `createPaidVoiceProxy`, for scene rooms only. It admits the two
 * vendors a scripted scene needs (Deepgram streaming STT and ElevenLabs TTS)
 * and nothing else: no model, no scoring.
 *
 * Imports no CLI and no keys, so every rule here is unit tested
 * (guestSceneGate.test.ts) without opening a room.
 */

import { tokenize } from '@livekit/agents';
import {
  GUEST_CAFE_SCENE,
  GUEST_SCENE_MAX_SECONDS,
  directiveFor,
  isGuestScene,
  parseFirstPracticeBrief,
  type GuestScene,
  type Lesson,
  type Rung,
} from '@luvani/core';
import { PaidAdmissionError } from '../../shared/paidAdmission.ts';
import type { PaidGate } from '../../shared/paidExecution.ts';
import { scriptedSpeech } from './scriptedSpeech.ts';

/** At most this many Deepgram streams per scene: the first, and one reconnect. */
export const GUEST_SCENE_STT_SOCKETS = 2;

/**
 * At most this many ElevenLabs calls per scene.
 *
 * The scene can say 32 distinct sentences (guestSceneSpeech below). Every one
 * is an authored line, so a successful synthesis is written to the disk cache
 * and every later use replays free; on a warm volume a scene makes no TTS call
 * at all. A cold volume pays each line once. The 16 on top cover lines a
 * barge-in cut off before they finished, which are not cached and can be
 * asked for again. At about 60 characters a line that bounds a scene at roughly
 * 2,900 characters even on a cold volume.
 */
export const GUEST_SCENE_TTS_CALLS = 48;

const KEY = /^[A-Za-z0-9_-]{43}$/;

export interface GuestRoomMeta {
  mode?: unknown;
  guestLifecycleKey?: unknown;
  firstPractice?: unknown;
  scene?: unknown;
}

export interface GuestRoom {
  guestKey?: string;
  scene?: GuestScene;
  firstPractice?: ReturnType<typeof parseFirstPracticeBrief>;
}

/**
 * Decide, from signed metadata alone and before any claim or vendor work,
 * whether this room may run and as what.
 *
 * - A scene needs a guest key, a lesson mode, no first-practice brief, and
 *   `LUVANI_GUEST_SCENE=1` on this worker (in every environment).
 * - A guest without a scene keeps the convo first-practice rules.
 * - In production a guest room runs only as a scene; the guest convo stays shut.
 */
export function admitGuestRoom(meta: GuestRoomMeta, env: Record<string, string | undefined>): GuestRoom {
  const guestKey = typeof meta.guestLifecycleKey === 'string' && KEY.test(meta.guestLifecycleKey) ? meta.guestLifecycleKey : undefined;
  if (meta.scene !== undefined && !isGuestScene(meta.scene)) throw new Error('invalid signed scene');
  const scene = meta.scene === undefined ? undefined : (meta.scene as GuestScene);
  if (scene && !guestKey) throw new Error('a scene needs a guest binding');
  if (guestKey && env.NODE_ENV === 'production' && !(scene && env.LUVANI_GUEST_SCENE === '1')) {
    throw new Error('guest production paid admission unavailable');
  }
  if (scene) {
    if (env.LUVANI_GUEST_SCENE !== '1') throw new Error('guest scenes are off on this worker');
    if (meta.mode !== 'lesson' && meta.mode !== 'lesson-text') throw new Error('invalid guest scene binding');
    if (meta.firstPractice !== undefined) throw new Error('invalid guest scene binding');
    return { guestKey, scene };
  }
  const firstPractice = parseFirstPracticeBrief(meta.firstPractice);
  if (guestKey && (!firstPractice || meta.mode !== 'convo')) throw new Error('invalid first practice binding');
  return { ...(guestKey ? { guestKey } : {}), ...(firstPractice ? { firstPractice } : {}) };
}

/** The lesson a scene runs. The scene name selects it; `lessonId` never does. */
export function sceneLesson(_scene: GuestScene): Lesson {
  return GUEST_CAFE_SCENE;
}

/**
 * Every sentence the scene tutor can send to TTS, exactly as the framework
 * would send it.
 *
 * The tutor speaks whole utterances (scriptedSpeech over each turn, every rung,
 * rescued or not, new turn or not) and the "hear it again" replay speaks the
 * target alone. The framework's sentence tokenizer then cuts each utterance
 * into the strings each HTTP request carries, merging short sentences, so the
 * list is built from that same tokenizer over the same utterances, the way
 * authoredSpeech.ts builds the warm corpus.
 */
export function guestSceneSpeech(lesson: Lesson = GUEST_CAFE_SCENE): ReadonlySet<string> {
  const splitter = new tokenize.basic.SentenceTokenizer();
  const lines = new Set<string>();
  const add = (text: string) => { for (const sentence of splitter.tokenize(text)) lines.add(sentence.replace(/\s+/g, ' ').trim()); };
  for (const turn of lesson.turns) {
    add(turn.target);
    for (const rung of [1, 2, 3, 4] as Rung[]) for (const rescued of [false, true]) for (const newTurn of [false, true]) {
      add(scriptedSpeech(turn, directiveFor(rung, rescued), { newTurn }));
    }
  }
  lines.delete('');
  return lines;
}

/**
 * A scene room's gate needs a guest key and must not also hold paid admission.
 * Both present or both absent is a binding nobody signed, so it fails closed.
 */
export function assertGuestSceneBinding(binding: { guestKey?: string; paid?: unknown }): void {
  const guest = typeof binding.guestKey === 'string' && KEY.test(binding.guestKey);
  const paid = binding.paid !== undefined && binding.paid !== null;
  if (guest === paid) throw new PaidAdmissionError('guest-scene-binding');
}

export interface GuestSceneGate {
  /** Fits PaidVoiceProxyOptions.gate. */
  gate: PaidGate;
  /** Fits PaidVoiceProxyOptions.speechAllowList: exact bytes, no normalisation. */
  admitsText(text: string): boolean;
  readonly sttSockets: number;
  readonly ttsCalls: number;
}

export function createGuestSceneGate(options: {
  guestKey?: string;
  paid?: unknown;
  /** The signed, resolved ElevenLabs voice id. */
  voiceId: string;
  /** The pinned TTS model. */
  model: string;
  signal: AbortSignal;
  lines?: ReadonlySet<string>;
}): GuestSceneGate {
  assertGuestSceneBinding(options);
  if (!options.voiceId || !options.model) throw new PaidAdmissionError('guest-scene-binding');
  const lines = options.lines ?? guestSceneSpeech();
  const maxTextBytes = Math.max(...[...lines].map((line) => Buffer.byteLength(line)));
  let sttSockets = 0, ttsCalls = 0;
  const gate: PaidGate = async (descriptor, requestSignal) => {
    options.signal.throwIfAborted();
    requestSignal?.throwIfAborted();
    if (descriptor.kind === 'stt' && descriptor.provider === 'deepgram') {
      const audio = descriptor.quantities.audioMillis;
      if (sttSockets >= GUEST_SCENE_STT_SOCKETS || !Number.isInteger(audio) || audio < 1 || audio > GUEST_SCENE_MAX_SECONDS * 1000) {
        throw new PaidAdmissionError('guest-scene-stt');
      }
      sttSockets++;
    } else if (descriptor.kind === 'tts' && descriptor.provider === 'elevenlabs') {
      if (descriptor.voice !== options.voiceId || descriptor.model !== options.model || ttsCalls >= GUEST_SCENE_TTS_CALLS
        || descriptor.quantities.textBytes < 1 || descriptor.quantities.textBytes > maxTextBytes) {
        throw new PaidAdmissionError('guest-scene-tts');
      }
      ttsCalls++;
    } else {
      // Every model route, scoring and anything new: a scene has no use for them.
      throw new PaidAdmissionError('guest-scene-route');
    }
    return requestSignal ? AbortSignal.any([options.signal, requestSignal]) : options.signal;
  };
  return {
    gate,
    admitsText: (text) => typeof text === 'string' && lines.has(text),
    get sttSockets() { return sttSockets; },
    get ttsCalls() { return ttsCalls; },
  };
}

/**
 * The scene's own clock, independent of settlement.
 *
 * `graceMillis` before the ceiling it stops paid work and starts settling; at
 * the ceiling it disconnects whether or not settlement ever answered.
 * Returns a cancel for a room that closed first.
 */
export function armSceneHardStop(options: {
  remainingMillis: number;
  graceMillis?: number;
  stopPaidWork: () => void;
  notify?: () => void;
  settle: () => Promise<unknown>;
  disconnect: () => unknown;
}): () => void {
  const grace = Math.min(options.graceMillis ?? 2_000, Math.max(0, options.remainingMillis));
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true; clearTimeout(early); clearTimeout(ceiling);
    try { options.stopPaidWork(); } catch { /* the room still closes */ }
    void Promise.resolve().then(options.disconnect).catch(() => {});
  };
  const early = setTimeout(() => {
    try { options.notify?.(); } catch { /* the room still closes */ }
    try { options.stopPaidWork(); } catch { /* the room still closes */ }
    let settling: Promise<unknown>;
    try { settling = options.settle(); } catch (error) { settling = Promise.reject(error); }
    void settling.then(close, close);
  }, Math.max(0, options.remainingMillis - grace));
  const ceiling = setTimeout(close, Math.max(0, options.remainingMillis));
  return () => { closed = true; clearTimeout(early); clearTimeout(ceiling); };
}
