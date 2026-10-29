/**
 * What went wrong with a live session, and what to say about it.
 *
 * This file exists because the hook used to answer every possible failure with
 * one of three strings — and one of them, "Could not start the session.", was
 * reached by a denied microphone held by another tab, a 401 from the token
 * server, an ICE timeout, and an insecure browsing context alike. A learner
 * cannot act on that, and neither can whoever is debugging it.
 *
 * Two rules hold here. Every failure names itself in plain words, and every
 * failure has a door: either the learner can type instead of speak, or they can
 * go back. No numbers, and nothing that reads as the learner's fault.
 */

import { ConnectionError, ConnectionErrorReason, DeviceUnsupportedError, MediaDeviceFailure } from 'livekit-client';
import type { ErrorKind } from '@luvani/core';

export type LiveFailure =
  /** The browser or OS refused the microphone. */
  | 'mic-denied'
  /** There is no microphone on this device. */
  | 'mic-missing'
  /** Something else holds the microphone — another tab, another app. */
  | 'mic-in-use'
  /** No microphone API at all: an insecure origin, or an unsupported browser. */
  | 'mic-unavailable'
  /** Speech is disabled here, and the service explicitly supports typing. */
  | 'voice-unavailable'
  /** The token server did not answer. */
  | 'server-unreachable'
  /** The token server answered, and said no for a reason we cannot act on. */
  | 'server-refused'
  /** Refused for now: too many starts in too short a window. */
  | 'rate-limited'
  /** Refused because this learner already has a session open somewhere else. */
  | 'session-elsewhere'
  /** The app's own typed session is still closing after Speak switched it to voice (F903). */
  | 'own-session-closing'
  /** Refused because nobody is signed in. */
  | 'sign-in-required'
  /** Reached the room service, but the signal connection failed. */
  | 'signal'
  /** Signalled fine, but no audio path could be established. Usually ICE. */
  | 'media'
  /** Connected, and the tutor never joined the room. */
  | 'agent-absent'
  /** The tutor joined, made a sound, and never produced anything to render. */
  | 'agent-silent'
  /** Was live, then the connection went away. */
  | 'dropped'
  // The four below are mid-session, and none of them is the connection's fault:
  // the room is fine and one half of the tutor's pipeline is not. They are named
  // for what the learner can no longer do, never for the vendor that broke.
  /** Transcription is down. The tutor cannot hear the learner. */
  | 'tutor-deaf'
  /** Speech is down. The tutor's voice is gone. */
  | 'tutor-mute'
  /** The tutor cannot produce a reply at all. Typing does not help. */
  | 'tutor-stalled'
  /** Turn-taking is down. The tutor will not notice being cut in on. */
  | 'tutor-talks-over'
  | 'unknown';

/** Thrown by the hook when the token server answers with something unusable. */
export class TokenServerError extends Error {
  readonly status: number;
  readonly code: 'voice-unavailable' | 'own-session-closing' | undefined;
  constructor(status: number, code?: 'voice-unavailable' | 'own-session-closing') {
    super(`token server replied ${status}`);
    this.name = 'TokenServerError';
    this.status = status;
    this.code = code;
  }
}

/** Read only our capability code; remote prose never becomes learner copy. */
export function tokenFailureCode(status: number, body: unknown): 'voice-unavailable' | undefined {
  if (status !== 503 || !body || typeof body !== 'object') return undefined;
  const value = body as Record<string, unknown>;
  const modes = value.supportedModes;
  return value.error === 'voice-unavailable' && Array.isArray(modes)
    && modes.length === 2 && modes.includes('lesson-text') && modes.includes('convo-text')
    ? 'voice-unavailable' : undefined;
}

/**
 * Web only, and checked BEFORE connecting. An app served over plain http from
 * anything but localhost has no `navigator.mediaDevices` at all, so the usual
 * getUserMedia rejection never happens — you get a TypeError deep inside
 * livekit-client instead. Catching it here is the difference between "open this
 * over https" and a shrug.
 */
export function micApiUnavailable(): boolean {
  if (typeof navigator === 'undefined') return false;
  return !navigator.mediaDevices;
}

export function classifyFailure(err: unknown): LiveFailure {
  // Device faults first: livekit-client's own matcher understands the whole
  // getUserMedia error family, including NotReadableError, which the regex this
  // replaced missed entirely.
  const device = MediaDeviceFailure.getFailure(err);
  if (device === MediaDeviceFailure.PermissionDenied) return 'mic-denied';
  if (device === MediaDeviceFailure.NotFound) return 'mic-missing';
  if (device === MediaDeviceFailure.DeviceInUse) return 'mic-in-use';
  if (err instanceof DeviceUnsupportedError) return 'mic-unavailable';

  if (err instanceof TokenServerError) {
    // 5xx means it is there and broken; 4xx means it is there and refusing.
    // "Refusing" was one bucket, and it told a rate-limited learner, a learner
    // with a session open on another device, and a signed-out learner all the
    // same thing: sign out and back in. Wrong for the first two, and for the
    // second it is the move that loses them the session they still had.
    //
    // A known capability code is read alongside the status. The reply carries a sentence of its own and it
    // is deliberately thrown away: everything below comes from the closed table
    // in this file, so nothing a learner reads can be changed by a deploy of
    // something else. The out-of-minutes 402 never arrives here at all; the
    // hook answers it with the paywall before this is reached.
    if (err.status === 503 && err.code === 'voice-unavailable') return 'voice-unavailable';
    if (err.status === 409 && err.code === 'own-session-closing') return 'own-session-closing';
    if (err.status >= 500) return 'server-unreachable';
    switch (err.status) {
      case 401:
        return 'sign-in-required';
      case 409:
        return 'session-elsewhere';
      case 429:
        return 'rate-limited';
      default:
        return 'server-refused';
    }
  }

  if (err instanceof ConnectionError) {
    switch (err.reason) {
      case ConnectionErrorReason.NotAllowed:
      case ConnectionErrorReason.ServiceNotFound:
        return 'server-refused';
      case ConnectionErrorReason.ServerUnreachable:
        return 'server-unreachable';
      case ConnectionErrorReason.WebSocket:
        return 'signal';
      case ConnectionErrorReason.LeaveRequest:
        return 'dropped';
      case ConnectionErrorReason.Timeout:
      case ConnectionErrorReason.InternalError:
        // The peer connection giving up is reported as an internal error whose
        // message is "could not establish pc connection". On one machine that
        // is almost always the room service advertising a LAN address for media
        // that the browser is not allowed to reach.
        return /pc connection|ice|peer/i.test(err.message) ? 'media' : 'signal';
      default:
        return 'unknown';
    }
  }

  // A failed fetch is a TypeError with a message that varies by engine, so the
  // name is the reliable part.
  if (err instanceof TypeError) return 'server-unreachable';
  if (err instanceof Error && /fetch|network/i.test(err.message)) return 'server-unreachable';

  // No mediaDevices at all surfaces as a TypeError from inside the client.
  if (err instanceof Error && /mediaDevices|getUserMedia/i.test(err.message)) return 'mic-unavailable';

  return 'unknown';
}

export interface FailureCopy {
  /** The small label above the sentence. */
  label: string;
  /** One or two plain sentences. Never a number, never a reproach. */
  message: string;
  /**
   * True when typing is a real answer to this failure. The tutor is the same
   * tutor either way, so a microphone problem is a situation, not a dead end.
   */
  canType: boolean;
}

const COPY: Record<LiveFailure, FailureCopy> = {
  'voice-unavailable': {
    label: 'Voice unavailable',
    message: 'Voice is not available here. You can have this conversation by typing instead.',
    canType: true,
  },
  'mic-denied': {
    label: 'Microphone blocked',
    message: 'Luvani needs your microphone to hear you speak. Allow it for this site and try again, or carry on by typing.',
    canType: true,
  },
  'mic-missing': {
    label: 'No microphone',
    message: 'This device has no microphone Luvani can use. You can still have the whole conversation by typing.',
    canType: true,
  },
  'mic-in-use': {
    label: 'Microphone busy',
    message: 'Another app or tab is holding the microphone. Close it and try again, or carry on by typing.',
    canType: true,
  },
  'mic-unavailable': {
    label: 'Microphone unavailable',
    message: 'Luvani cannot open the microphone here. You can have the whole conversation by typing instead.',
    canType: true,
  },
  // The one failure a learner is most likely to meet, and the one that read
  // worst: "Check it is running, then try again" is advice for whoever runs the
  // service. A learner has no process to check, and Back was the only move on
  // the screen. Typing stays closed on purpose — it goes through the same token
  // server — so the way forward has to be the rest of the app, which is all
  // on-device and completely unaffected.
  'server-unreachable': {
    label: 'Tutor unavailable',
    message: 'Luvani cannot reach your tutor right now. Practice works offline, so you can carry on there. Try again in a little while.',
    canType: false,
  },
  'server-refused': {
    label: 'Session refused',
    message: 'Luvani could not start a session for this account. Signing out and back in usually settles it.',
    canType: false,
  },
  // The three refusals below used to share the line above, and sign out and
  // back in is the right advice for none of them. Each says what happened and
  // the one move that ends it.
  //
  // All three keep typing closed, and that is a decision rather than a copy of
  // the line above. A typed conversation asks this same service for this same
  // credential: it is counted by the same limit, held off by the same
  // one-session-per-learner lease, and refused by the same signed-in check. An
  // offer to type here would fail one tap later, which is a worse place to
  // find out than this screen.
  'rate-limited': {
    label: 'A short wait',
    message: 'Luvani needs a short pause before it can start another session. Try again in a minute or two.',
    canType: false,
  },
  // Two learners meet this one, and the first draft only spoke to one of them.
  //
  // The lease is taken when the token is granted and kept for thirty minutes,
  // and the only thing that gives it back early is the tutor reporting the end
  // of a session it actually ran. So a learner who leaves during connect, which
  // the connecting screen invites them to do, holds a lease on a session that
  // never opened, dispatched no tutor, and has nothing to end. Telling that
  // learner to end it somewhere else is an instruction with no "somewhere
  // else" in it, and with typing closed it was the only move on the screen.
  //
  // The second sentence keeps the real fix for the learner who does have
  // another device. The third is for the one who does not: the wait is named
  // as the lease's own length rather than a hopeful minute, and it points at
  // practice, which is on-device and reached by the Back this screen always
  // draws.
  'own-session-closing': {
    label: 'Still closing',
    message: 'Your typed session is still closing. Give it a moment, then tap Try again.',
    canType: false,
  },
  'session-elsewhere': {
    label: 'Session already open',
    // One string literal, not a concatenation: the surface walk in
    // surfaceContract.test.ts reads these messages with a `message: '...'`
    // regex, and a second half on its own line would never be walked at all.
    message: 'Luvani still has a French session open for you. If it is on another device, end it there and try again. If you just left one here, it clears itself within half an hour, and practice works offline until then.',
    canType: false,
  },
  'sign-in-required': {
    label: 'Signed out',
    message: 'Luvani cannot start a session while you are signed out. Sign in again and your progress is right where you left it.',
    canType: false,
  },
  signal: {
    label: 'Could not connect',
    message: 'The connection would not hold. Check your network and try again.',
    canType: false,
  },
  media: {
    label: 'No audio path',
    message: 'The connection opened but the sound could not get through. Try again in a moment, or switch to another network.',
    canType: false,
  },
  'agent-absent': {
    label: 'Tutor did not answer',
    message: 'Your tutor did not pick up. The room opened but nobody joined it, so nothing has been counted against your minutes.',
    canType: false,
  },
  'agent-silent': {
    label: 'Tutor went quiet',
    message: 'Your tutor joined and then went quiet before saying anything. This one is on us, not on you. Nothing has been counted against your minutes.',
    canType: false,
  },
  // "Your progress is saved." was the opposite of what happens. The journal
  // covers everything AFTER the recap arrives and a session killed before it
  // leaves nothing behind — the pre-recap window in docs/STATE_AND_STORAGE.md.
  // A learner read that line, believed the conversation was banked, and stopped.
  // Say the loss plainly and give them the one move that works.
  dropped: {
    label: 'Connection lost',
    message: 'The connection dropped and this session could not be saved. Start a fresh one when you are ready.',
    canType: false,
  },
  'tutor-deaf': {
    label: 'Tutor cannot hear',
    message: 'The tutor cannot hear right now. You can keep going by typing, or leave and come back later.',
    canType: true,
  },
  'tutor-mute': {
    label: 'Tutor cannot speak',
    message: 'The tutor cannot speak right now. You can keep going by typing, or leave and come back later.',
    canType: true,
  },
  // No typed door on purpose. The half that is down is the half that writes the
  // reply, and typing reaches the same one, so offering it would be a promise
  // the app cannot keep. Practice is on-device and completely unaffected.
  'tutor-stalled': {
    label: 'Tutor unavailable',
    message: 'The tutor cannot carry on right now. Practice works offline, so you can pick that up and come back to this later.',
    canType: false,
  },
  'tutor-talks-over': {
    label: 'Tutor talks over you',
    message: 'The tutor cannot tell when you start speaking. You can keep going by typing, or leave and come back later.',
    canType: true,
  },
  unknown: {
    label: 'Session problem',
    message: 'Something stopped the session before it started. Try again, and if it keeps happening the details below are worth sending us.',
    canType: false,
  },
};

export function failureCopy(failure: LiveFailure): FailureCopy {
  return COPY[failure] ?? COPY.unknown;
}

// ────────────────────────────────────────────── the tutor's pipeline, mid-session
//
// Everything above classifies an exception thrown while a session was being
// STARTED. This half classifies a frame that arrives while one is running: the
// agent's `error` message, which now carries the vendor's own `kind` and its
// `recoverable` flag (see ERROR_KINDS in @luvani/core).
//
// It exists because one sentence was answering for all five. A Deepgram outage
// meant the tutor could not HEAR, and the learner was told its VOICE had gone —
// so they kept talking to something that would never answer, while the meter
// ran. Naming the failure by what the learner can no longer do is the whole fix;
// naming it by the vendor that broke would be the same mistake in nicer words.
//
// Two decisions are worth stating, because both are the cautious direction:
//
//   - A missing `recoverable` is treated as recoverable. An older agent sends a
//     bare `error`, and so does a session hitting its time limit. Taking the
//     screen away from a learner on a guess is worse than a notice that clears.
//   - A missing `kind` keeps the agent's own sentence. It is the only honest
//     thing left to show, and it is exactly what the app does today.

/** The parts of an `error` frame this classification reads. Nothing else. */
export interface PipelineErrorFrame {
  /** The agent's sentence. Written by us, never anything the learner said. */
  message: string;
  kind?: ErrorKind;
  recoverable?: boolean;
}

/**
 * What the app should do about it.
 *
 * A union rather than a struct with a severity field, so that rendering a dead
 * pipeline as a self-clearing notice is not something a caller can do by
 * forgetting an `if`. That forgetting is the bug: the handler discarded the type
 * and the flag, and a dead recogniser read as a passing blip.
 */
export type PipelineOutcome =
  /**
   * The learner cannot feel this one, so do not interrupt them. A typed session
   * carries no audio in either direction, which makes every audio failure in it
   * invisible by construction. Still logged.
   */
  | { severity: 'silent'; log: string }
  /**
   * The room, the microphone and the meter are all still running. Show the
   * sentence the way a notice is shown, and let it clear itself. Never a door,
   * because there is nothing to escape.
   */
  | { severity: 'notice'; message: string; log: string }
  /**
   * The session cannot go on as it is. Hand this to the same failure screen
   * every other live failure lands on: `failureCopy(failure)` has the words and
   * the `canType` flag, and a `canType` failure needs the screen to be given its
   * typed door, or the sentence promises a way out that is not on the screen.
   */
  | { severity: 'blocking'; failure: LiveFailure; log: string };

/**
 * Which failure each vendor kind is, in the learner's terms.
 *
 * `Record<ErrorKind, …>` on purpose: a sixth kind added to the protocol does not
 * compile until it says what the learner has lost, rather than quietly inheriting
 * a generic line.
 */
const KIND_FAILURE: Record<ErrorKind, LiveFailure> = {
  stt_error: 'tutor-deaf',
  tts_error: 'tutor-mute',
  // Both of these are the reply itself failing. One is the text model, one is a
  // model that hears and answers in a single piece; the learner loses the same
  // thing either way, and the log line keeps which it was.
  llm_error: 'tutor-stalled',
  realtime_model_error: 'tutor-stalled',
  interruption_detection_error: 'tutor-talks-over',
};

/** The quiet version. One short line, no door, nothing to act on. */
const KIND_NOTICE: Record<ErrorKind, string> = {
  stt_error: 'The tutor did not catch that. Give it a moment and try again.',
  tts_error: 'The tutor lost its voice for a moment. It should be back shortly.',
  llm_error: 'The tutor lost its thread for a moment. It should pick the conversation back up.',
  realtime_model_error: 'The tutor dropped out for a moment. Give it a second to come back.',
  interruption_detection_error: 'The tutor may talk over you for a moment. Carry on as you were.',
};

/**
 * Kinds that can only reach a learner who is listening and speaking.
 *
 * In a typed session there is no audio in either direction, so a dead recogniser
 * or a dead voice changes nothing the learner can see. Telling them the tutor
 * cannot hear them, while they type, would be both alarming and untrue.
 */
const AUDIO_ONLY: ReadonlySet<ErrorKind> = new Set<ErrorKind>([
  'stt_error',
  'tts_error',
  'interruption_detection_error',
]);

/** The ordinary per-event line, same channel as the rest of the live trace. */
export const PIPELINE_LOG_PREFIX = '[luvani:live] pipeline';

/**
 * The stable alarm string. A vendor half of the tutor is down and not coming
 * back on its own. Renaming this breaks whoever is grepping for it during an
 * incident, which is the only time it matters.
 */
export const PIPELINE_ALARM_PREFIX = '[luvani] TUTOR_PIPELINE_DOWN';

/**
 * One greppable line, prefix included.
 *
 * What goes in it: what broke, whether it is coming back, which kind of session
 * it happened in, and what the learner was shown. What never goes in it: the
 * frame's sentence, anything transcribed, anything said. Absent fields are left
 * out rather than printed as a guess, which is diagnostics.ts's rule and
 * timing.ts's before it.
 */
function pipelineLog(
  kind: ErrorKind | undefined,
  recoverable: boolean | undefined,
  spoken: boolean,
  shown: PipelineOutcome['severity'],
): string {
  const parts: string[] = [];
  if (kind !== undefined) parts.push(`kind=${kind}`);
  if (recoverable !== undefined) parts.push(`recoverable=${recoverable ? 'yes' : 'no'}`);
  parts.push(`mode=${spoken ? 'spoken' : 'typed'}`);
  parts.push(`shown=${shown}`);
  // The alarm is about the vendor, not about who saw it: a dead recogniser is
  // worth grepping for even in a typed session where nobody was hurt, and
  // `shown=silent` on the same line says so.
  const prefix = recoverable === false ? PIPELINE_ALARM_PREFIX : PIPELINE_LOG_PREFIX;
  return `${prefix} ${parts.join(' ')}`;
}

/**
 * Classify one `error` frame.
 *
 * `spoken` is whether this session carries audio at all — `modeCarriesAudio(mode)`
 * at the call site. It is a required argument rather than a default because
 * getting it wrong is how a typed learner gets told their microphone failed.
 */
export function classifyPipelineError(
  frame: PipelineErrorFrame,
  { spoken }: { spoken: boolean },
): PipelineOutcome {
  const { kind, recoverable } = frame;
  const log = (shown: PipelineOutcome['severity']): string => pipelineLog(kind, recoverable, spoken, shown);

  if (kind !== undefined && !spoken && AUDIO_ONLY.has(kind)) {
    return { severity: 'silent', log: log('silent') };
  }

  if (recoverable === false) {
    // No kind means an agent older than ERROR_KINDS, or a failure outside the
    // five. Either way something has ended the tutor's side of this, and
    // 'tutor-stalled' is the one line true of all of them.
    return { severity: 'blocking', failure: kind === undefined ? 'tutor-stalled' : KIND_FAILURE[kind], log: log('blocking') };
  }

  return {
    severity: 'notice',
    message: kind === undefined ? frame.message : KIND_NOTICE[kind],
    log: log('notice'),
  };
}
